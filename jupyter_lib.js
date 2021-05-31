// Print to notebook cell output...
let elem_proto = Object.getPrototypeOf(element);

elem_proto.println = function(obj){
    this.append(((obj === undefined)? "": obj) + "<br>\n");
};

elem_proto.print = function(obj){
    this.append((obj === undefined)? "": obj);
};

// canvas.getBoundingClientRect() 
// window.requestAnimationFrame
elem_proto.getCanvasAndPainter = function(width, height, stretch = true, heightStretch = false) {
    let canvStyle = (stretch)? ((heightStretch)? " style='height: 75vh;'": " style='width: 100%;'"): " style='margin-right: auto; margin-left: auto; display: block;'";
    let jqCanvas = $.parseHTML("<canvas width='" + width + "' height='" + height +  "'" + canvStyle + ">");
    
    let painter = jqCanvas[0].getContext("2d");
    painter.imageSmoothingEnabled = false;
    
    this.append(jqCanvas);
    
    return [jqCanvas[0], painter];
};

// For loading images...
function loadImage(url) {
    return new Promise(function(resolve, reject) {
        let img = new Image();
        
        img.onload = function() {
            resolve(img);
        };
        img.onerror = function() {
            reject("Unable to load image");
        };
        
        img.src = url;
    })
}

window.loadImage = loadImage;


function range(start = 0, stop = undefined, step = 1) {
    let fstart = (stop != undefined)? start: 0;
    let fstop = (stop != undefined)? stop: start;
    let fstep = (step == 0)? 1: step;
    
    let numSteps = Math.floor((fstop - fstart) / fstep);
    
    let array = [];
    for(let i = 0, val = fstart; i < numSteps; i++, val += fstep) {
        array[i] = val;
    }
    
    return array;
}
window.range = range; // Make range accessible outside this code...

/* Animation:
let spritemap = {
    "image": "...",
    "width": 30, // In pixels, default is to match image height...
    "animations": {
        "run": {
            "speed": 1, // In millis
            "frames": [0, 1, 5, 8, 3, 4], // Frames
            "cycles": -1 // Number of cycles (negative means forever)
        }
    }
}
*/

let fdiv = (x, y) => Math.floor(x / y);

class Sprite {
    constructor(img, width, animations) {
        this._img = img;
        this._animations = animations;
        this._selected = null;
        
        this._height = img.height;
        this._width = ((width <= 0) || (width == null))? this._height: width; 
        
        this._numImages = Math.floor(img.width / this._width);
        
        this._speed = 16;
        this._frames = range(0, this._numImages);
        this._cycles = Infinity;
        
        this._index = 0;
        this._accumulator = 0;
    }
    
    setAnimation(animationName) {
        self._selected = ((animationName == null) || !(animationName in this._animations))? null: animationName;
        
        let anim = (self._selected != null)? this._animations[self._selected]: {};
        
        // Update properties...
        this._speed = ((anim.speed == null) || (anim.speed < 1))? 16: anim.speed;
        this._frames = anim.frames ?? range(0, this._numImages);
        this._cycles = ((anim.cycles == null) || (anim.cycles < 0))? Infinity: anim.cycles;
        
        for(let i = 0; i < this._frames.length; i++) {
            this._frames[i] = Math.abs(this._frames[i]) % this._numImages;
        }
        
        // Reset the index and accumulator.
        this._index = 0;
        this._accumulator = 0;
    }
    
    getAnimation() {
        return this._selected;
    }
    
    get width() {
        return this._width;
    }
    
    get height() {
        return this._height;
    }
    
    update(timeDelta) {
        this._accumulator += timeDelta;
        
        // Update the index and accumulator...
        this._index += fdiv(this._accumulator, this._speed);
        this._accumulator %= this._speed;
        
        // Update the cycles based on new index.
        this._cycles -= fdiv(this._index, this._frames.length);
        this._index %= this._frames.length;
        
        if(this._cycles <= 0) {
            this._cycles = 0;
            this._index = this._frames.length - 1;
        }
    }
    
    draw(ctx, x, y, width, height) {
        let imgIdx = this._frames[this._index];
        let xin = this._width * imgIdx;
        
        ctx.drawImage(this._img, xin, 0, this._width, this._height, x, y, width, height);
    }
}

window.Sprite = Sprite;


class Camera {
    constructor(canvas, minPixelsShown) {
        this._canvas = canvas;
        this._minPixelsShown = minPixelsShown;
        this._zoom = 1;
        this._track = null;
        this._centerPoint = [0, 0];
    }
    
    setMinimumPixelsShown(value) {
        this._minPixelsShown = value;
    }
    
    update(gameState) {
        let minCanvasSide = Math.min(this._canvas.width, this._canvas.height);
        this._zoom = this._minPixelsShown / minCanvasSide;
        
        if("getHitBox" in this._track) {
            let [x, y, w, h] = this._track.getHitBox();
            
            this._centerPoint = [x - w / 2, y - h / 2];
        }
    }
    
    getBounds() {
        let [cx, cy] = this._centerPoint;
        let w = this._canvas.width / this._zoom;
        let h = this._canvas.height / this._zoom;
        
        return [cx - w / 2, cy - h / 2, w, h];
    }
    
    transform(point) {
        let [x, y] = point;
        
        let [gx, gy, gw, gh] = this.getBounds();
        let cw = this._canvas.width;
        let ch = this._canvas.height;
        
        return [((x - gx) / gw) * cw, ((y - gy) / gh) * ch]
    }
    
    transformBox(box) {
        let [x, y, w, h] = box;
        
        let [p1x, p1y] = this.transform(x, y);
        let [p2x, p2y] = this.transform(x + w, y + h);
        
        return [p1x, p1y, p2x - p1x, p2y - p2y];
    }
}

window.Camera = Camera;

elem_proto.makeGame = async function(gameLoop, gameState = {}) {
    
    let newDiv = $($.parseHTML("<div style='position: fixed; z-index: 300; top: 0; bottom: 0; left: 0; right: 0; background-color: white;'></div>"));
    let newCanvas = $($.parseHTML("<canvas style='width: 100%; height: 100%;'>Your browser doesn't support canvas!</canvas>"));
    let closeBtn = $($.parseHTML("<button style='position: absolute; top: 0; right: 0;'>X</button>"));
        
    newDiv.append(newCanvas);
    newDiv.append(closeBtn);
    
    $(document.body).append(newDiv);
    
    gameState = {...gameState};
    
    gameState.lastTimeStamp = null;
    gameState.keepRunning = true;
    gameState.canvas = newCanvas[0];
    gameState.painter = newCanvas[0].getContext("2d");
    gameState.keysPressed = {};
    
    
    function loopManager(timeStamp) {
        let {width, height} = gameState.canvas.getBoundingClientRect();
        
        gameState.canvas.width = width;
        gameState.canvas.height = height;
        
        let timeStep = (gameState.lastTimeStamp == null)? 0: timeStamp - gameState.lastTimeStamp;
        
        gameLoop(timeStep, gameState);
        
        gameState.lastTimeStamp = timeStamp;
                
        if(gameState.keepRunning) {
            window.requestAnimationFrame(loopManager);
        }
    };
    
    // Manage keyboard events, keep track of pressed keys in special property in the gameState object.
    let doc = $(document);
    doc.off("keydown");
    
    doc.on("keydown.gameloop", (event) => {
        gameState.keysPressed[event.key] = true;
    });
    
    doc.on("keyup.gameloop", (event) => {
        delete gameState.keysPressed[event.key];
    });
    
    // If the close button is clicked delete the div and terminate the game loop.
    closeBtn.click(() => {
        newDiv.remove();
        gameState.keepRunning = false;
        doc.off(".gameloop");
        try {
            Jupyter.keyboard_manager.bind_events();
        } catch(e) {
            console.log(e);
        }
    });
    
    // Start the game loop.
    window.requestAnimationFrame(loopManager);
};
