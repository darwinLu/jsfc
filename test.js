import {FC} from './fc.js'

var jsfc = new FC()

window.onload = function(){
    // /** @type {HTMLCanvasElement} */ 
    // var c = document.getElementById('jsfc_canvas')
    // var ctx = c.getContext('2d')
    // ctx.fillStyle = '#FF0000'
    // ctx.fillRect(0,0,200,200)
    loadNesFile()
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
    jsfc.reset(nesData)
}



// window.requestAnimationFrame(drawFrame)

// function drawFrame(){
//     window.requestAnimationFrame(drawFrame)
// }