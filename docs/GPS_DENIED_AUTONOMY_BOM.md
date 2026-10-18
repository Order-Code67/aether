# Автономный дрон без GPS — комплектующие, подключение, ПО

Практичный стек для **миссий по waypoints** с позиционированием через **VIO / vision** (без GNSS в полёте).  
Целевой FC: **ArduPilot (Copter)** на Pixhawk-совместимой плате. Companion считает позу и отдаёт её в EKF по MAVLink.

> Это не «докрутить optical nav в Aether на iNav». Aether / ESP32-CAM остаются удобны для отладки камеры и идеи, но полётный estimator — на companion.

---

## 1. Комплектующие (BOM)

| # | Комплектующее | Пример / класс | Зачем |
|---|---------------|----------------|-------|
| 1 | Полётный контроллер | Pixhawk 6C / Cube Orange / Holybro Kakute H7 (ArduPilot) | EKF, моторы, миссии, failsafe |
| 2 | Companion computer | Raspberry Pi 5 (4–8 GB) или Orange Pi 5 / Jetson Orin Nano | VIO/VSLAM в реальном времени |
| 3 | Камера вниз (основная для VIO) | Global-shutter USB/CSI: e.g. Arducam OV9281 / IMX219 CSI | Optical/VIO трек земли |
| 4 | (Опц.) Вторая камера вперёд | Та же серия | Улучшение VIO / препятствия (позже) |
| 5 | Дальномер вниз | TF-Luna / VL53L1X / Lightware LW20 | Высота AGL для масштаба и посадки |
| 6 | IMU на FC | Встроенный в Pixhawk | Основной IMU EKF |
| 7 | (Опц.) Внешний IMU на companion | ICM-42688 и т.п. на той же плате, что камера | Жёсткая camera–IMU sync для VIO |
| 8 | Рама + моторы + ESC + пропеллеры | Под ваш размер (5–7″ / 10″) | Силовая часть |
| 9 | Приёмник RC | ELRS / CRSF | Ручной override, failsafe |
| 10 | Видео (опц., для оператора) | Аналог / Digi FPV | Наблюдение; **не** источник позы |
| 11 | Телеметрия | SiK / ELRS telem / USB на земле | QGC, заливка миссий |
| 12 | Питание companion | BEC 5 V ≥3 A (отдельный от FC 5 V) | Стабильное питание Pi/Jetson |
| 13 | Носитель ПО на земле | ПК с QGroundControl / Mission Planner | Миссии, калибровки |
| 14 | (Опц.) GPS только для базы | Любой GNSS на FC | **Только** привязка карты/дома на земле; в миссии можно не использовать |
| 15 | microSD | В FC + в companion | Логи Blackbox/Ardu + ROS bags |

**Ориентир бюджета (грубо):** рама/силовая отдельно; nav-стек (FC + Pi5 + камера + дальномер + BEC) ≈ класс «средний DIY», не гоночный минимум.

---

## 2. Что к чему подключать

### 2.1. Схема связей

```
                  ┌─────────────┐
   LiPo ──► PDB ──┤ Pixhawk FC  ├──► ESC ×4 ──► моторы
              │   │  ArduPilot  │
              │   └──────┬──────┘
              │          │ TELEM2 / SERIAL (MAVLink 921600)
              │          ▼
              │   ┌─────────────┐     CSI/USB
              └──►│ Companion   │◄──── камера вниз
           5V BEC │ (RPi / Jetson)│
                  │  VIO node   │◄──── дальномер (I²C/UART/USB)
                  └─────────────┘
                         │
                         ▼  (Wi‑Fi/Ethernet на земле — отладка)
                    QGroundControl
```

### 2.2. Таблица подключений

| От | К | Интерфейс | Примечание |
|----|---|-----------|------------|
| PDB / BEC 5 V | Pixhawk `POWER` | Силовой разъём FC | По схеме платы; не путать с servo rail |
| PDB / отдельный BEC 5 V ≥3 A | Raspberry Pi `5V` | USB‑C / GPIO 5V+GND | **Отдельный** BEC от камеры/Pi — иначе просадки |
| ESC сигналы | Pixhawk `MAIN/AUX` OUT | PWM / DShot | Распиновка рамы (X/quad) |
| ELRS RX | Pixhawk `RCIN` или UART | CRSF | `SERIAL protocol = RCIN` / CRSF |
| Companion UART (GPIO14/15 на Pi) | Pixhawk `TELEM2` | TTL UART 3.3 V | Общий GND; **не** RS232 уровни |
| Камера вниз | Pi CSI или USB3 | CSI предпочтительнее (ниже latency) | Жёстко вниз, без люфта |
| TF-Luna / LW20 | Pixhawk `SERIAL4/5` **или** Pi UART/I²C | UART 115200 типично | Если в FC — проще для `RNGFND`; для VIO можно дублировать на Pi |
| (Опц.) GPS | Pixhawk `GPS1` | UART + I²C safety | Можно не ставить для «без GPS»; удобен для калибровки home |
| FPV VTX | Своя камера / FC cam | Аналог/Digi | Не смешивать с VIO-камерой |
| Ноут ↔ FC | USB `SLCAN/CDC` или telem | USB | Прошивка, параметры |
| Ноут ↔ Companion | SSH / Ethernet | Wi‑Fi AP на Pi | ROS / MAVROS отладка |

**Важно**

- UART Pixhawk ↔ Pi: Tx↔Rx перекрёстно, GND общий, 3.3 V TTL.  
- Камера и IMU для VIO должны быть **жёстко** на одной пластине (экструзия недопустима).  
- Пропеллеры / вибрации: мягкий маунт FC + жёсткий маунт камеры (компромисс по докам VIO).

---

## 3. Программирование и настройка (по шагам)

### 3.1. Полётный контроллер (ArduPilot Copter)

| Шаг | Действие |
|-----|----------|
| 1 | Прошить **ArduCopter** актуальной стабильной ветки (Mission Planner / QGC / `ardupilot` custom) |
| 2 | Калибровки: акселерометр, компас (если есть), радио, ESC, уровень горизонта |
| 3 | Рама: `FRAME_TYPE` / `FRAME_CLASS` под ваш квад |
| 4 | Дальномер: `RNGFND1_TYPE`, порт, `RNGFND1_MAX_CM`, проверка в HUD |
| 5 | EKF3: включить использование vision — типично `EK3_SRC1_POSXY = 6` (ExternalNav), `EK3_SRC1_VELXY = 6`, высота с баро/rangefinder по доке вашей версии |
| 6 | Vision/odometry: принять `VISION_POSITION_ESTIMATE` / `ODOMETRY` с companion (`VISO_*` / `VIS_*` параметры — сверять с [ArduPilot Vision Position](https://ardupilot.org/copter/docs/common-vio-tracking-camera.html) для вашей версии) |
| 7 | Failsafe: RC loss → Land / RTL **только если** есть валидная поза; иначе Land немедленно |
| 8 | Режимы на пульте: Stabilize / AltHold / Loiter(vision) / Auto / Land |
| 9 | Логи: `LOG_BACKEND_TYPE`, после каждого теста — `.bin` |

Параметры меняются версия к версии — всегда сверяйте wiki под ваш `AP_VERSION`.

### 3.2. Companion (Raspberry Pi / Jetson)

| Шаг | Действие |
|-----|----------|
| 1 | ОС: Raspberry Pi OS 64-bit **или** Ubuntu 22.04 (Jetson — JetPack) |
| 2 | Установить ROS 2 (Humble/Jazzy) **или** лёгкий стек без ROS (MAVSDK + свой VIO) |
| 3 | Драйвер камеры: `v4l2` / CSI `libcamera`; проверить `fps ≥ 30`, global shutter желателен |
| 4 | Поставить VIO: **OpenVINS** / **VINS-Fusion** / готовый **PX4/Ardu vision** пакет под вашу камеру |
| 5 | Калибровка камеры (intrinsics): Kalibr / OpenCV chessboard |
| 6 | Калибровка camera–IMU extrinsics (Kalibr) — критично |
| 7 | MAVLink мост: **MAVROS** / **MAVSDK** → порт FC `TELEM2`, baud **921600** |
| 8 | Публиковать позу в FC: `VISION_POSITION_ESTIMATE` (msg 102) или `ODOMETRY` с правильным frame (NED/ENU — как ждёт Ardu) |
| 9 | Автозапуск systemd: VIO + MAVLink bridge после boot |
| 10 | Синхронизация времени: желательно `chrony` / PTP; иначе растёт innov EKF |

### 3.3. Миссии (земля)

| Шаг | Действие |
|-----|----------|
| 1 | QGroundControl → подключение к FC (USB или телеметрия) |
| 2 | Home = точка взлёта (локальный NED origin при vision) |
| 3 | Миссия: WP в **метрах относительно home** (проще без GPS) или lat/lon после разовой привязки |
| 4 | Взлёт: ручной / Takeoff в Auto при уверенном vision fix |
| 5 | Режим **Auto** только после успешных Loiter-тестов |
| 6 | Посадка: Land / RTL по vision; запасная ручная по FPV |

### 3.4. Aether в этой схеме (опционально)

| Задача | Роль Aether |
|--------|-------------|
| Отладка ESP32-CAM / потока | Camera + optical nav (лаборатория) |
| MSP/iNav | Не основной путь для автономии |
| Inject VISION с ПК | Можно гонять стенд без companion, **не** для боевого контура |
| Прошивка Arduino-периферии | IDE как обычно |

---

## 4. Минимальная программа испытаний (не пропускать)

| # | Тест | Критерий «ок» |
|---|------|----------------|
| 1 | Камера на столе, VIO трек | Траектория гладкая, loop при возврате |
| 2 | Дрон на привязи, AltHold | Высота стабильна по дальномеру |
| 3 | Loiter по vision, 30–60 с | Удержание ±0.5–1 m (зал / текстура) |
| 4 | Квадрат 5×5 m Auto | Ошибка на углах приемлема для вашей задачи |
| 5 | Потеря vision (закрыть объектив) | FC: failsafe Land, без «улёта» |
| 6 | Вибрации на ховере | EKF innovations в норме, нет расходимости |

Пока п.3–4 не стабильны — **миссию в поле не грузить**.

---

## 5. iNav vs этот BOM

| | iNav FPV (прошлый разговор) | Этот автономный BOM |
|--|-----------------------------|---------------------|
| Цель | Подсказка оператору | Миссии Auto без GPS |
| Поза | Optical flow в Aether | VIO на companion |
| FC | iNav | ArduPilot (рекомендуется) |
| Inject vision | Выкл. | Вкл. (основной вход EKF) |
| GPS | Опц. для home | Опц. только для привязки |

Если остаётесь строго на **iNav**: полноценные длинные GPS-denied миссии официально и практически заметно слабее; максимум — короткие локальные задачи с optical flow/лидаром и без гарантий WP-точности.

---

## 6. Чеклист заказа (скопировать)

- [ ] Pixhawk-совместимый FC + ArduCopter  
- [ ] Raspberry Pi 5 / Jetson + microSD  
- [ ] BEC 5 V ≥3 A для companion  
- [ ] Global-shutter камера вниз + кабель CSI/USB  
- [ ] Дальномер вниз + проводка UART/I²C  
- [ ] ELRS RX  
- [ ] Рама, моторы, ESC, пропы, LiPo  
- [ ] Кабели TELEM2 ↔ UART Pi (Tx/Rx/GND)  
- [ ] Ноут + QGroundControl  
- [ ] (Опц.) GPS-модуль для базы  
- [ ] (Опц.) FPV-линк отдельно от VIO-камеры  

---

## 7. Ссылки (документация)

- ArduPilot Vision Position Estimation: https://ardupilot.org/copter/docs/common-vio-tracking-camera.html  
- ArduPilot EKF sources: https://ardupilot.org/copter/docs/common-ekf-sources.html  
- OpenVINS: https://docs.openvins.com/  
- MAVLink `VISION_POSITION_ESTIMATE`: https://mavlink.io/en/messages/common.html#VISION_POSITION_ESTIMATE  
- Внутреннее (лаборатория Aether): [`OPTICAL_NAV.md`](./OPTICAL_NAV.md)

---

*Документ — инженерный каркас DIY. Перед полетами в населённых зонах соблюдайте местные правила и failsafe; GPS-denied автономия требует стендовых проверок EKF и поведения при потере vision.*
