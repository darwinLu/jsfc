import {FC} from './fc.js'

var SCREEN_WIDTH = 256;
var SCREEN_HEIGHT = 240;

var jsfc = new FC()

var canvas_ctx = null
var image = null
var buffer = null
var framebuffer_u8 = null
var framebuffer_u32 = null
var colorNumber = 0x000000
var frameCount = 0

window.onload = function(){
    // /** @type {HTMLCanvasElement} */ 
    // var c = document.getElementById('jsfc_canvas')
    // var ctx = c.getContext('2d')
    // ctx.fillStyle = '#FF0000'
    // ctx.fillRect(0,0,200,200)
    loadNesFile()
	initCanvas()
	window.requestAnimationFrame(onAnimationFrame);
}

function loadNesFile(){
    var req = new XMLHttpRequest();
	req.open("GET", './roms/nestest.nes');
	req.overrideMimeType("text/plain; charset=x-user-defined");
	// req.onerror = () => console.log(`Error loading ${path}: ${req.statusText}`);
	
	req.onload = function() {
		if (this.status === 200) {
		    reset(this.responseText);
		} else if (this.status === 0) {
			// Aborted, so ignore error
		} else {
			// req.onerror();
		}
	};
	
	req.send();
}

function reset(nesData){
	// var data = new Uint8Array(new ArrayBuffer(nesData.length))
	// for (var i = 0, il = nesData.length; i < il; i++) {
	// 	var value = nesData.charCodeAt(i)
	// 	data[i] = value > 0xFF ? 0x20 : value
	// }
    jsfc.reset(nesData,framebuffer_u32)
}

function initCanvas(){
	var canvas = document.getElementById('jsfc_canvas')
	canvas_ctx = canvas.getContext('2d')
	// canvas初始化为黑色
	canvas_ctx.fillStyle = '0xFFFFFF'
	canvas_ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
	// getImageData() 方法返回 ImageData 对象,其中保存了画布指定矩形的像素数据
	// 每个像素数据包含RGBA信息，以数组形式存在，并存储于 ImageData 对象的 data 属性中
	// 256*240个像素点，每个像素点包含4Byte的RGBA数据，因此image的长度应为256*240*4=245760
	image = canvas_ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
	// buffer长度为245760
	buffer = new ArrayBuffer(image.data.length)
	// 从buffer引用出一个Uint8ClampedArray类型的数组来操作二进制数据，这个数组用来更新canvas
	framebuffer_u8 = new Uint8ClampedArray(buffer)
	// 从buffer引用出一个32位无符号整数数组，用来传递到jsfc来设置ARGB数据，它和framebuffer_u8其实指向同一个buffer，只是分割方式不同
	framebuffer_u32 = new Uint32Array(buffer)
	// console.log(framebuffer_u32.length)
	// image.data.set(framebuffer_u8)
	// canvas_ctx.putImageData(image, 0, 0)
	// canvas_ctx.fillStyle = '#'+ toFormattedHex(colorNumber,6)
	// canvas_ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
}

function onAnimationFrame(){
	frameCount++
	window.requestAnimationFrame(onAnimationFrame);
	jsfc.onFrame()
	// console.log('on AnimationFrame:'+frameCount)
	// if(colorNumber <= 0xFFFFFF){
	// 	colorNumber++
	// }
	// else{
	// 	colorNumber = 0x000000
	// }
	// canvas_ctx.fillStyle = '#' + toFormattedHex(colorNumber,6)
	// canvas_ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
	image.data.set(framebuffer_u8)
	canvas_ctx.putImageData(image, 0, 0)

}

function toFormattedHex(num,length){
	var len = num.toString(16).length
	var outStr = num.toString(16).toUpperCase()
	while(len < length) {
		outStr = '0' + outStr
		len++
	}
	return outStr
}


// window.requestAnimationFrame(drawFrame)

// function drawFrame(){
//     window.requestAnimationFrame(drawFrame)
// }