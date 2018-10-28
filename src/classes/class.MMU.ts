/**
 * The memory management unit.
 */
export default class MMU {
  /**
   * Flag indicating BIOS is mapped in.
   * BIOS is unmapped with the first instruction above 0x00FF.
   */
  private inBIOS: boolean;

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

  constructor() {
    this.inBIOS = true;
    this.BIOS = new Uint8Array(256);
    this.ROM = new Uint8Array(16384);
    this.workingRAM = new Uint8Array(8192);
    this.externalRAM = new Uint8Array(8192);
    this.zeroPageRAM = new Uint8Array(128);
  }

  /**
   * Read a byte from memory.
   *
   * @param address
   */
  public readByte(address: number): number {
    switch (address & 0xf000) {
      /**
       * BIOS (256 B) || ROM0
       */
      case 0x0000:
        return this.inBIOS && address < 0x0100
          ? this.BIOS[address]
          : this.ROM[address];

      /**
       * ROM0
       */
      case 0x1000:
      case 0x2000:
      case 0x3000:
        return this.ROM[address];

      /**
       * ROM1 (unbanked) 16 KiB
       */
      case 0x4000:
      case 0x5000:
      case 0x6000:
      case 0x7000:
        return this.ROM[address];

      /**
       * Graphics: VRAM (8 KiB)
       */
      case 0x8000:
      case 0x9000:
        throw new Error("VRAM not implemented.");

      /**
       * External RAM (8 KiB)
       */
      case 0xa000:
      case 0xb000:
        return this.externalRAM[address & 0x1fff];

      /**
       * Working RAM (8 KiB)
       */
      case 0xc000:
      case 0xd000:
        return this.workingRAM[address & 0x1fff];

      /**
       * Working RAM shadow
       */
      case 0xe000:
        return this.workingRAM[address & 0x1fff];

      /**
       * Working RAM shadow, I/O, Zero-page RAM
       */
      case 0xf000:
        switch (address & 0x0f00) {
          // Working RAM shadow.
          case 0x000:
          case 0x100:
          case 0x200:
          case 0x300:
          case 0x400:
          case 0x500:
          case 0x600:
          case 0x700:
          case 0x800:
          case 0x900:
          case 0xa00:
          case 0xb00:
          case 0xc00:
          case 0xd00:
            return this.workingRAM[address & 0x1fff];

          // Graphics: Object Attribute Memory
          // OAM is 160 bytes, remaining bytes read as 0.
          case 0xe00:
            if (address < 0xfea0) {
              throw new Error("GPU OAM not implemented.");
            }
            return 0;

          case 0xf00:
            if (address >= 0xff80) {
              return this.zeroPageRAM[address & 0x7f];
            }
            throw new Error("I/O Control not implemented.");
        }
        break;
    }

    return 0;
  }

  /**
   * Read a 16-bit word.
   *
   * @param address
   */
  public readWord(address: number): number {
    return this.readByte(address) + (this.readByte(address) << 8);
  }
}
