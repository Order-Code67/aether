/**
 * Streaming MSP frame parser (v1 `$M>` / `$M!` and v2 `$X>` / `$X!`).
 */

import {
  crc8DvbS2,
  xorChecksum,
  type MspFrame,
} from "./codec";

export class MspParser {
  private buf: number[] = [];

  reset(): void {
    this.buf = [];
  }

  push(bytes: Uint8Array | number[]): MspFrame[] {
    for (let i = 0; i < bytes.length; i++) this.buf.push(bytes[i]!);
    if (this.buf.length > 8192) {
      this.buf = this.buf.slice(this.buf.length - 4096);
    }
    const frames: MspFrame[] = [];
    while (true) {
      const frame = this.tryExtract();
      if (!frame) break;
      frames.push(frame);
    }
    return frames;
  }

  private tryExtract(): MspFrame | null {
    const buf = this.buf;
    let start = -1;
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0x24 && (buf[i + 1] === 0x4d || buf[i + 1] === 0x58)) {
        start = i;
        break;
      }
    }
    if (start < 0) {
      if (buf.length > 1) this.buf = buf.slice(-1);
      return null;
    }
    if (start > 0) this.buf = buf.slice(start);
    if (this.buf.length < 3) return null;

    const proto = this.buf[1]!;
    if (proto === 0x4d) return this.tryExtractV1();
    if (proto === 0x58) return this.tryExtractV2();
    this.buf.shift();
    return null;
  }

  private tryExtractV1(): MspFrame | null {
    if (this.buf.length < 6) return null;
    const dirByte = this.buf[2]!;
    if (dirByte !== 0x3c && dirByte !== 0x3e && dirByte !== 0x21) {
      this.buf.shift();
      return null;
    }
    const size = this.buf[3]!;
    const total = 6 + size;
    if (this.buf.length < total) return null;
    const cmd = this.buf[4]!;
    const payload = new Uint8Array(this.buf.slice(5, 5 + size));
    const checksum = this.buf[5 + size]!;
    const expected = xorChecksum(size, cmd, payload);
    this.buf = this.buf.slice(total);
    if (checksum !== expected) return null;
    return {
      version: 1,
      direction: dirByte === 0x3c ? "to_fc" : "from_fc",
      cmd,
      payload,
    };
  }

  private tryExtractV2(): MspFrame | null {
    if (this.buf.length < 9) return null;
    const dirByte = this.buf[2]!;
    if (dirByte !== 0x3c && dirByte !== 0x3e && dirByte !== 0x21) {
      this.buf.shift();
      return null;
    }
    const flag = this.buf[3]!;
    const cmd = this.buf[4]! | (this.buf[5]! << 8);
    const size = this.buf[6]! | (this.buf[7]! << 8);
    if (size > 4096) {
      this.buf.shift();
      return null;
    }
    const total = 9 + size;
    if (this.buf.length < total) return null;
    const payload = new Uint8Array(this.buf.slice(8, 8 + size));
    const crc = this.buf[8 + size]!;
    const expected = crc8DvbS2(new Uint8Array(this.buf.slice(3, 8 + size)));
    this.buf = this.buf.slice(total);
    if (crc !== expected) return null;
    return {
      version: 2,
      direction: dirByte === 0x3c ? "to_fc" : "from_fc",
      cmd,
      payload,
      flag,
    };
  }
}
