import {CPU} from './cpu.js'
import {PPU} from './ppu.js'
import {Rom} from './rom.js'


export class FC{
    constructor(romPath){
        this.romPath = romPath
        this.cpu = new CPU()
        this.ppu = PPU.getInstance()
        this.rom = new Rom()
        this.vBuffer = new Array(256 * 240);
    }
    
    reset(nesData,framebuffer_u32){
        //从nes文件读取到rom
        var romData = nesData
        //从rom获取mapper编号
        //将rom信息按照mapper规则映射到内存
        this.rom.loadRom(romData)
        //上一步已经把rom映射到内存了，现在resetcpu，开始执行指令了
        // 此处还需要把ppu的内存也提前映射好
        this.cpu.reset()
        // PPU复位
        this.ppu.reset()
        this.vBuffer = framebuffer_u32
        //按照mapper编号将rom映射到memory
        //设置reset中断
        //跳转到第一条指令开始执行
        this.onFrame()
    }

    onFrame(){
        // 每帧应运行的时钟周期为 1789772.5（每秒总周期）/ 60 = 29829
        // 先实现帧同步，后续再考虑高精度的同步
        var cyclePerFrame = 29829
        var cycleCount = 0
        let currentInstructionCycle = 0
        for(;;){
            // 先运行CPU一段时间，即运行29829次CPU
            // 如果是中高精度同步，此过程内PPU应该逐行输出到显示缓冲区
            currentInstructionCycle += this.cpu.execute()
            if(this.cpu.emulateEnd == 1){
                break
            }
            cycleCount++
            // ppu的速度应该是cpu的3倍，真正硬件是一个周期写一个像素点的所有数据
            // 还需要完善
            if(currentInstructionCycle > cyclePerFrame){
                break
            }
            // this.ppu.execute()
            // let tempTime = new Date().getTime()
            // let cps = 1000 /(tempTime - startTime)
            // // // console.log(cps)
            // while(cps > 1782579){
            //     this.sleep(1)
            //     tempTime = new Date().getTime()
            //     cps = 1000 /(tempTime - startTime)
            // }
            // var colorNumber = new Number(0x000000)    
            // if(colorNumber <= 0xFFFFFF){
            //     colorNumber++
            // }
            // else{
            //     colorNumber = 0x000000
            // }
            // var color = this.toFormattedHex(colorNumber,6)
            // color = 'FF' + color
            // for(var i=0;i<256*240*4;i++){
            //     this.vBuffer[i] = '0x88'
            // }
        }
        // 再运行PPU，应输出一帧的全部像素，然后执行V-BLANK
        this.ppu.execute(this.vBuffer,this.cpu)
        // this.cpu.INTERRUPT_NMI = 1
        // console.log('end emulate')
    }

    toFormattedHex(num,length){
        var len = num.toString(16).length
        var outStr = num.toString(16).toUpperCase()
        while(len < length) {
            outStr = '0' + outStr
            len++
        }
        return outStr
    }
    sleep(time) {
        var startTime = new Date().getTime() + parseInt(time, 10);
        while(new Date().getTime() < startTime) {}
    };
}

// var fc = function(){
//     this.myLoader = new loader()
// }
// cpu.execute()
// fc.myLoader.loadHeader()