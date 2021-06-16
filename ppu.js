import {PPUMemory} from './ppu-memory.js'

export class PPU{
    constructor(){
        this.vmemory = PPUMemory.getInstance()
        this.initPalette()
        // 当前扫描线，初始化为-1
        this.scanline = -1
        // 当前像素点位置，初始化为0
        this.pixelX = 0
        // 是否触发nim中断
        this.nim = false
    }
    reset(){
        console.log('PPU reset')
    }
    // PPU每次执行会决定1个像素点，然后写入到需要前台输出的缓冲中
    // 实际的PPU是每次执行时直接向屏幕输出1个像素，但模拟时可以等到1帧的像素全部确定后，在用绘图API绘制到屏幕
    // 暂时先实现帧同步，一次性输出所有像素点
    execute(buffer,cpu){
        // 输出CPU内存位置0x2000的PPU寄存器值
        var ppuReg = cpu.memory.load(0x2000)
        cpu.memory.write(0x2000,0x00)
        console.log('ppu reg'+ ppuReg)
        // 输出256*240 = 61440个像素点
        for(let i=0;i<61440;i++){
            // 向屏幕缓冲区填充随机像素
            // buffer[curCycle] = this.toFormattedHex(parseInt(Math.random()*256).toString(16),2)
            // console.log(buffer[curCycle])
            buffer[i] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)
        }
        // 按照nameTable中的数据输出背景像素
        // 从显存的0x2000处开始取数据，取出第一屏的960个tile
        for(let i=0x2000;i<0x23C0;i++){
            // 解析每一个tile，获取它指向的PatternTabel的代码
            let tileCode = this.vmemory.load(i)
            console.log('tileCode:'+tileCode)
            // 有了tileCode，能直到图样的形状位置位于显存的0x0000+tileCode地址处，分为前后各8Byte
            // 所以应该一次性读取16Byte，然后拆分成前8Byte和后8Byte
            // 此时已经通过PatternTable获取到了需要渲染的图案形状，只需再通过这两个点阵加上属性表来确定实际的颜色，然后逐个输出就可以了
            // 先不取颜色，尝试只把点阵输出，取前8Byte中64个像素点对应位置的bit值和后8Byte中64个像素点的bit值相加，得到0-3的值，然后设置4中默认颜色来输出
            let patternFrontLine1 = this.vmemory.load(tileCode)
            let patternBackLine1 = this.vmemory.load(tileCode + 8)
            // console.log('f:'+patternFrontLine1 +';b:'+patternBackLine1)
            for(let j=0;j<7;j++){
                let bit0 = patternFrontLine1 >> j & 1
                let bit1 = patternBackLine1 >> j & 1
                let bit = bit0 + bit1
                if(bit == 0){
                    buffer[j] = 0xFF000000 | 0xFFFFFF
                }
                if(bit == 1){
                    buffer[j] = 0xFF000000 | 0x000000
                }
                if(bit == 2){
                    buffer[j] = 0xFF000000 | 0x00FFFF
                }
                if(bit == 3){
                    buffer[j] = 0xFF000000 | 0x00FF00
                }
            }


        }

        // // 预备阶段
        // console.log(this.scanline+';'+this.pixelX)
        // if(this.scanline == -1){
        //     cpu.INTERRUPT_NMI = 0
        // }
        // // 正常渲染，需要计算出1个像素的颜色
        // if(this.scanline >= 0 && this.scanline < 240){
        //     // 只有0-255共256个像素点有颜色
        //     if(this.pixelX < 256)
        //     buffer[this.scanline * 256 + this.pixelX] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)

        //     // buffer[curCycle] = 0xFF000000 | this.toFormattedHex(parseInt(Math.random()*256*256*256).toString(16),6)
        // }
        // // TO FIX NMI中断，其实不应在这触发
        // if(this.scanline == 240){
        //     cpu.INTERRUPT_NMI = 1
        // }
        // // 走一个像素点
        // this.pixelX++
        // // 走完一行像素，增加扫描线行数到下一行
        // if(this.pixelX > 341){
        //     this.scanline++
        //     this.pixelX = 0
        // }
        // // console.log('ppu execute')

    }
    setBuffer(buffer){
        
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
    initPalette(){
        //64色调色盘RGB表示
        this.palette = 
        [0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840,
         0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
         0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1,
         0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
         0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7, 
         0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000, 
         0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF, 
         0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000]
    }

}