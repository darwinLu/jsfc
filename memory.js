//CPU可寻址内存（64KB）
//CPU能寻址的所有地址空间，包括卡带上的空间
import {PPU} from './ppu.js'

export class Memory{
    constructor(){
        this.instance = null 
        this.mem = new Array(0xFFFF)
        this.ppu = PPU.getInstance()
    }

    static getInstance(){
        if(!this.instance){
            this.instance = new Memory()
            return this.instance
        }
        else{
            return this.instance
        }
    }

    writeToMemory(romData,startAddress,endAddress){
        for(let i=0;i<romData.length;i++){
            this.mem[startAddress+i] = romData[i]
        }
    }

    load(address){
        let data
        if(address >= 0x2000 && address <= 0x2007){
            // load from ppu reg
            switch(address){
                case 0x2000:
                    // 只写寄存器，不能读取
                    break
                case 0x2002:
                    // console.log('reading 2002')
                    data = this.ppu.readPPUSTATUS()
                    break
                case 0x2004:
                    data = 0x00
                    break
                case 0x2007:
                    data = this.ppu.readData()
                    break
                // case 0x2005:
                //     data = this.ppu.PPUSCROLL
                //     break
                default:
                    data = 0x00
            }
        }
        else{
            data = this.mem[address]
        }
        return data
        // if(address < 0x2000){
        //     return this.mem[address]
        // }
        // else{
        //     // 超出FC的可写内存（2KB）后，应该是和PPU发生读写
        //     switch(address){
        //         case 0x2000 :
        //             return 0xFF
        //     }
        // }

    }

    write(address,data){
        // this.mem[address] = data
        // PPU寄存器范围0x2000——0x2007
        if(address >= 0x2000 && address <= 0x2007){
            switch(address){
                case 0x2000:
                    this.ppu.writePPUCTRL(data)
                    break
                case 0x2001:
                    break
                case 0x2002:
                    // 只读寄存器，不能写
                    break
                case 0x2006:
                    this.ppu.writeVRAMAddress(data)
                    break
                case 0x2007:
                    // console.log('address is 2007')
                    this.ppu.writeVRAM(data)
                    break
                default:
            }
        }
        else{
            this.mem[address] = data
        }
    }
}