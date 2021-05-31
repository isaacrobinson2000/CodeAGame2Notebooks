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

function loadJSON(url) {
    return new Promise(function(resolve, reject) {
        $.getJSON(url)
        .done(function(json) {
            resolve(json);
        })
        .fail(function(jqxhr, textStatus, error) {
            reject(error);
        });
    });
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

async function getSpriteBuilder(imgConfig) {
    return {
        _img: await loadImage(imgConfig.image),
        _width: imgConfig.width,
        _animations: imgConfig.animations,
        buildSprite: function() {
            return new Sprite(this._img, this._width, this._animations);
        }
    };
}

class Camera {
    constructor(canvas, minPixelsShown) {
        this._canvas = canvas;
        this._minPixelsShown = minPixelsShown;
        this._zoom = 1;
        this._track = null;
        this._centerPoint = [0, 0];
    }
    
    setCenterPoint(cp) {
        this._centerPoint = [cp[0], cp[1]];
    }
    
    getCenterPoint() {
        return this._centerPoint;
    }
    
    setTrackedObject(track) {
        this._track = track;
    }
    
    setMinimumPixelsShown(value) {
        this._minPixelsShown = value;
    }
    
    update(gameState) {
        let minCanvasSide = Math.min(this._canvas.width, this._canvas.height);
        this._zoom = minCanvasSide / this._minPixelsShown;
        
        if((this._track != null) && ("getHitBox" in this._track)) {
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
        
        let [p1x, p1y] = this.transform([x, y]);
        let [p2x, p2y] = this.transform([x + w, y + h]);
        
        return [p1x, p1y, p2x - p1x, p2y - p1y];
    }
    
    reverseTransform(point) {
        let [x, y] = point;
        
        let [gx, gy, gw, gh] = this.getBounds();
        let cw = this._canvas.width;
        let ch = this._canvas.height;
        
        return [((x / cw) * gw) + gx, ((y / ch) * gh) + gy];
    }
}

window.Camera = Camera;

elem_proto.makeBaseGame = async function(gameLoop, gameState = {}, levelData = {}, minPixelsShown = 32 * 10) {
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
    gameState.mousePressed = false;
    gameState.mouseLocation = [0, 0];
    gameState.camera = new Camera(newCanvas[0], minPixelsShown);
    
    gameState.sprites = {};
    
    for(let spriteName in (levelData.sprites ?? {})) {
        gameState.sprites[spriteName] = await getSpriteBuilder(levelData.sprites[spriteName]);
    }
    gameState.level = (levelData.level != null)? await loadJSON(levelData.level): {};
    
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
    
    // Mouse support....
    newDiv.mousedown((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
        gameState.mousePressed = true;
        return false;
    });
    
    newDiv.mousemove((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
    });
    
    newDiv.mouseup((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
        gameState.mousePressed = false;
        return false;
    });
    
    // Manage keyboard events, keep track of pressed keys in special property in the gameState object.
    let doc = $(document);
    // We have to disable all other keyevents as jupyter notebook doesn't play nicely with keyboard input.
    doc.off("keydown");
    
    doc.on("keydown.gameloop", (event) => {
        gameState.keysPressed[event.code] = true;
    });
    
    doc.on("keyup.gameloop", (event) => {
        delete gameState.keysPressed[event.code];
    });
    
    // If the close button is clicked delete the div and terminate the game loop. Also reattach jupyter keyboard events.
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


function _makeEmptyLevel() {
    let level = {
        "blockSize": 32,
        "chunkSize": 16,
        "numChunks": [10, 10],
        "chunks": []
    }
    let chunks = level.chunks;
    
    // Initial level with all null...
    for(let i = 0; i < level.numChunks[0]; i++) {
        chunks[i] = [];
        for(let j = 0; j < level.numChunks[1]; j++) {
            chunks[i][j] = _makeEmptyChunk(level.chunkSize);
        }
    }
    
    return level;
}

function _makeEmptyChunk(chunkSize) {
    let chunk = {"entities": [], "blocks": []};
    
    for(let k = 0; k < chunkSize; k++) {
        chunk.blocks[k] = [];
        for(let l = 0; l < chunkSize; l++) {
            chunk.blocks[k][l] = null;
        }
    }
    
    return chunk;
}

class GameObject {
    constructor(x, y, blockSize, sprites) {
        this._x = x;
        this._y = y;
        this._blockSize = blockSize;
    }
    update(timeStep, gameState) {}
    draw(canvas, painter, camera) {}
    drawPreview(canvas, painter, box) {}
    
    getLocation() {
        return [x, y];
    }
    
    getName() {}
}
window.GameObject = GameObject;


function _loadChunk(cx, cy, level, blockTypes, entityTypes, sprites) {
    let chunkSize = level.chunkSize;
    let newLoadedChunk = _makeEmptyChunk(chunkSize);
    
    // Load blocks...
    for(let x = 0; x < chunkSize; x++) {
        for(let y = 0; y < chunkSize; y++) {
            let blockName = level.chunks[cx][cy].blocks[x][y];
            let bx = cx * chunkSize * level.blockSize + x * level.blockSize;
            let by = cy * chunkSize * level.blockSize + y * level.blockSize;

            newLoadedChunk.blocks[x][y] = (blockName != null)? new (blockTypes[blockName](bx, by, level.blockSize, sprites)): null;
        }
    }
    
    // Load sprites...
    for(let [x, y, name] of level.chunks[cx][cy].entities) {
        newLoadedChunk.entities.push(new entityTypes[name](x, y, level.blockSize, sprites));
    }
    
    return newLoadedChunk;
}

function _unloadChunk(chunk, cx, cy, level) {
    let chunkSize = level.chunkSize;
    // Save the chunk blocks...
    for(let x = 0; x < chunkSize; x++) {
        for(let y = 0; y < chunkSize; y++) {
            let res = chunk.blocks[x][y]
            level.chunks[cx][cy].blocks[x][y] = (res != null)? res.getName(): null;
        }
    }
    
    level.chunks[cx][cy].entities = [];
    // Save chunk entities...
    for(let entity of chunk.entities) {
        level.chunks[cx][cy].entities.push([...entity.getLocation(), entity.getName()]);
    }
}

function _manageChunks(level, camera, loadedChunks, blockTypes, entityTypes, sprites) {
    let [cx, cy, cw, ch] = camera.getBounds();
        
    let chunkSide = level.blockSize * level.chunkSize; 
    let xStartChunk = Math.max(0, Math.floor(cx / chunkSide));
    let yStartChunk = Math.max(0, Math.floor(cy / chunkSide));
    let xEndChunk = Math.min(level.numChunks[0] - 1, Math.ceil((cx + cw) / chunkSide));
    let yEndChunk = Math.min(level.numChunks[1] - 1, Math.ceil((cy + ch) / chunkSide));
    
    let newLoadedChunks = [];
    let doneChunks = {};
    
    // Unload chunks that are out of the area... Keep others loaded...
    for(let [x, y, chunk] of loadedChunks) {
        if((x < xStartChunk || x > xEndChunk) || (y < yStartChunk || y > yEndChunk)) {
            _unloadChunk(chunk, x, y, level);
        }
        else {
            newLoadedChunks.push([x, y, chunk]);
            doneChunks[[x, y]] = true;
        }
    }

    // Load chunks in area...
    for(let xic = xStartChunk; xic <= xEndChunk; xic++) {
        for(let yic = yStartChunk; yic <= yEndChunk; yic++) {
            if(!([xic, yic] in doneChunks)) {
                newLoadedChunks.push([xic, yic, _loadChunk(xic, yic, level, blockTypes, entityTypes, sprites)]); 
            }
        }
    }
    
    loadedChunks = null;
    
    return newLoadedChunks;
}

function _gameObjListToMapping(list) {
    let mappingObj = {};
    
    for(let elem of list) {
        mappingObj[elem.getName()] = elem;
    }
    
    return mappingObj;
}

elem_proto.levelEditor = async function(levelPath = null, blockTypes = [], entityTypes = []) {
    let level = (levelPath == null)? _makeEmptyLevel(): await loadJSON(levelPath);
    let cameraVelocity = 200 / 1000;
    
    class GameHoverBlock extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._sprite = sprites["_levelEditHover"].buildSprite();
            this._sprite.setAnimation("main");
        }
        
        update(timeStep, gameState) {
            [this._x, this._y] = gameState.camera.reverseTransform(gameState.mouseLocation);
            this._x = Math.floor(this._x / this._blockSize) * this._blockSize;
            this._y = Math.floor(this._y / this._blockSize) * this._blockSize;

            this._sprite.update(timeStep);
        }
        
        draw(canvas, painter, camera) {
            let [x, y, w, h] = camera.transformBox([this._x, this._y, this._blockSize, this._blockSize]);
            this._sprite.draw(painter, x, y, w, h);
        }
    }
    
    function update(timeStep, gameState) {
        let keys = gameState.keysPressed;
        let c = gameState.camera;
        let [cx, cy] = c.getCenterPoint();
        let stepAmt = cameraVelocity * timeStep;
            
        if("ArrowUp" in keys || "KeyW" in keys) cy -= stepAmt;
        if("ArrowDown" in keys || "KeyS" in keys) cy += stepAmt;
        if("ArrowLeft" in keys || "KeyA" in keys) cx -= stepAmt;
        if("ArrowRight" in keys || "KeyD" in keys) cx += stepAmt;
        
        c.setCenterPoint([cx, cy]);
        
        gameState.hoverIndicator.update(timeStep, gameState);
        c.update();
        
        gameState.loadedChunks = _manageChunks(
            level, gameState.camera, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, 
            gameState.sprites
        );
    }
    
    function draw(canvas, painter, gameState) {    
        // Clear the canvas...
        painter.fillStyle = "white"
        painter.fillRect(0, 0, canvas.width, canvas.height);
        
        for(let [x, y, chunk] of gameState.loadedChunks) {
            for(let bx = 0; bx < chunk.blocks.length; bx++) {
                let blockCol = chunk.blocks[bx];
                
                for(let by = 0; by < blockCol.length; by++) {
                    let block = blockCol[by];
                    if(block != null) block.draw(canvas, painter, gameState.camera);
                    
                    let gx = x * level.chunkSize * level.blockSize + bx * level.blockSize;
                    let gy = y * level.chunkSize * level.blockSize + by * level.blockSize;
                    let [canvX, canvY, canvW, canvH] = gameState.camera.transformBox([gx, gy, gx + level.blockSize, gy + level.blockSize]);
                    
                    painter.strokeStyle = "black";
                    painter.strokeRect(canvX, canvY, canvW, canvH);
                }
            }
            
            for(let entity of chunk.entities) {
                entity.draw(canvas, painter, gameState.camera);
            }
        }
            
        gameState.hoverIndicator.draw(canvas, painter, gameState.camera);
    }
    
    function gameLoop(timeStep, gameState) {
        if(gameState.hoverIndicator == null) {
            gameState.hoverIndicator = new GameHoverBlock(0, 0, level.blockSize, gameState.sprites);
        }
        
        update(timeStep, gameState);
        draw(gameState.canvas, gameState.painter, gameState);
    }
    
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(entityTypes);
    gameState.blockTypes = _gameObjListToMapping(blockTypes);
    gameState.loadedChunks = [];
    
    let data = {
        sprites: {
            "_levelEditHover": {
                "image": "levelEdit/hover.png",
                "animations": {
                    "main": {
                        "speed": 150
                    }
                }
            }
        }
    };
    
    this.makeBaseGame(gameLoop, gameState, data);
}
