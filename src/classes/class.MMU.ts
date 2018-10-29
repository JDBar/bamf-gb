import BIOS from "../data/data.BIOS";

/**
 * The memory management unit.
 */
export default class MMU {
  /**
   * Flag indicating BIOS is mapped in.
   * BIOS is unmapped with the first instruction above 0x00FF.
   */
  public inBIOS: boolean;

  /**
   * 0x0000 - 0x00FF
   * When the CPU starts up, the program counter starts at 0,
   * which is the start of the 256-byte GameBoy BIOS code.
   * Once the BIOS has run, it is removed from the memory map,
   * and this area of the cartridge becomes addressable.
   */
  private BIOS: Uint8Array;

  /**
   * 0x0000 - 0x3FFF
   * Cartridge ROM, bank 0.
   *
   * 0x0100 - 0x014F
   * Cartridge header.
   */
  private ROM: Uint8Array; // 16 KiB

  /**
   * 0xC000 - 0xDFFF
   * The GameBoy's internal 8k of RAM.
   */
  private workingRAM: Uint8Array; // 8 KiB

  /**
   * 0xA000 - 0xBFFF
   * There is a small amount of writeable memory available.
   * If a game requires more RAM than is available in the hardware,
   * additional 8k chunks of RAM can be made addressable here.
   */
  private externalRAM: Uint8Array; // 8 KiB

  /**
   * 0xFF80 - 0xFFFF
   * A high speed area of 128 bytes of RAM is available at the top of memory.
   */
  private zeroPageRAM: Uint8Array; // 128 B

  private map: IAddressHashMap;

  constructor() {
    this.inBIOS = true;
    this.BIOS = BIOS;
    this.ROM = new Uint8Array(16384);
    this.workingRAM = new Uint8Array(8192);
    this.externalRAM = new Uint8Array(8192);
    this.zeroPageRAM = new Uint8Array(128);

    /**
     * A map of address spaces to handler functions.
     */
    this.map = {
      0x0000: this.handle0000,
      0x1000: this.handle1000,
      0x2000: this.handle1000,
      0x3000: this.handle1000,
      0x4000: this.handle4000,
      0x5000: this.handle4000,
      0x6000: this.handle4000,
      0x7000: this.handle4000,
      0x8000: this.handle8000,
      0x9000: this.handle8000,
      0xa000: this.handleA000,
      0xb000: this.handleA000,
      0xc000: this.handleC000,
      0xd000: this.handleC000,
      0xe000: this.handleC000,
      0xf000: this.handleF000,
    };
  }

  /**
   * Read a byte from memory.
   *
   * @param address
   */
  public readByte(address: number): number {
    var result;
    address &= 0xffff;
    result = this.map[address & 0xf000](address);
    if (result == null) {
      throw new Error("Unexpected non-number value from read.");
    }
    return result;
  }

  /**
   * Read a 16-bit word.
   *
   * @param address
   */
  public readWord(address: number): number {
    address &= 0xffff;
    return this.readByte(address) + (this.readByte(address + 1) << 8);
  }

  /**
   * Writes a byte to memory.
   *
   * @param address
   * @param writeValue
   */
  public writeByte(address: number, writeValue: number): void {
    writeValue &= 0xff;
    this.map[address & 0xf000](address, writeValue);
  }

  /**
   * Writes a 16-bit word.
   *
   * @param address
   * @param writeValue
   */
  public writeWord(address: number, writeValue: number): void {
    writeValue &= 0xffff;
    this.writeByte(address, writeValue & 0xff);
    this.writeByte(address + 1, writeValue >> 8);
  }

  /**
   * BIOS (256 B) || ROM0
   */
  private handle0000(address: number, writeValue?: number): number | undefined {
    const toBIOS = this.inBIOS && address < 0x0100;
    if (writeValue == null) {
      return toBIOS ? this.BIOS[address] : this.ROM[address];
    } else if (toBIOS) {
      this.BIOS[address] = writeValue;
    } else {
      this.ROM[address] = writeValue;
    }
  }

  /**
   * ROM0
   */
  private handle1000(address: number, writeValue?: number): number | undefined {
    if (writeValue == null) {
      return this.ROM[address];
    } else {
      this.ROM[address] = address;
    }
  }

  /**
   * ROM1 (unbanked) 16 KiB
   */
  private handle4000(address: number, writeValue?: number): number | undefined {
    if (writeValue == null) {
      return this.ROM[address];
    } else {
      this.ROM[address] = address;
    }
  }

  /**
   * Graphics: VRAM (8 KiB)
   */
  private handle8000(address: number, writeValue?: number): number | undefined {
    throw new Error("VRAM not implemented.");
  }

  /**
   * External RAM (8 KiB)
   */
  private handleA000(address: number, writeValue?: number): number | undefined {
    if (writeValue == null) {
      return this.externalRAM[address & 0x1fff];
    } else {
      this.externalRAM[address & 0x1fff] = writeValue;
    }
  }

  /**
   * Working RAM (8 KiB)
   * Working RAM Shadow
   */
  private handleC000(address: number, writeValue?: number): number | undefined {
    if (writeValue == null) {
      return this.workingRAM[address & 0x1fff];
    } else {
      this.workingRAM[address & 0x1fff] = writeValue;
    }
  }

  /**
   * Working RAM shadow, OAM, Zero-page RAM, I/O
   */
  private handleF000(address: number, writeValue?: number): number | undefined {
    const address2 = address & 0x0f00;
    if (address2 <= 0xd00) {
      // Working RAM Shadow
      if (writeValue == null) {
        return this.workingRAM[address & 0x1fff];
      } else {
        this.workingRAM[address & 0x1fff] = writeValue;
      }
    } else if (address2 === 0xe00) {
      if (address < 0xfea0) {
        // GPU Object Attribute Memory
        throw new Error("GPU OAM not implemented.");
      } else {
        // 0xFEA0 - 0xFEFF is unused.
        if (writeValue == null) {
          return 0;
        }
      }
    } else {
      if (address >= 0xff80) {
        // Zero-page RAM
        if (writeValue == null) {
          return this.zeroPageRAM[address & 0x7f];
        } else {
          this.zeroPageRAM[address & 0x7f] = writeValue;
        }
      } else {
        // I/O
        throw new Error("I/O Control not implemented.");
      }
    }
  }
}

/**
 * Interfaces
 */

interface IAddressHashMap {
  [key: number]: (address: number, writeValue?: number) => number | undefined;
}
