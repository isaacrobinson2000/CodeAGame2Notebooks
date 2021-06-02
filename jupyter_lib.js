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
    
    getMinimumPixelsShown() {
        return this._minPixelsShown;
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
    
    closeBtn.mousedown(false);
    closeBtn.mouseup(false);
    closeBtn.mousemove(false);
    
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
        return [this._x, this._y];
    }
    
    static getName() {}
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

            newLoadedChunk.blocks[x][y] = (blockName != null)? new blockTypes[blockName](bx, by, level.blockSize, sprites): null;
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
            level.chunks[cx][cy].blocks[x][y] = (res != null)? res.constructor.getName(): null;
        }
    }
    
    level.chunks[cx][cy].entities = [];
    // Save chunk entities...
    for(let entity of chunk.entities) {
        level.chunks[cx][cy].entities.push([...entity.getLocation(), entity.constructor.getName()]);
    }
}

function _manageChunks(level, camera, loadedChunks, blockTypes, entityTypes, sprites) {
    // Issue: Blocks just dissapear!
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

function _findChunk(x, y, loadedChunks) {
    for(let [cx, cy, chunk] of loadedChunks) {
        if((cx == x) && (cy == y)) return chunk;
    }
    
    return null;
}

function _gameObjListToMapping(list) {
    let mappingObj = {};
    
    for(let elem of list) {
        mappingObj[elem.getName()] = elem;
    }
        
    return mappingObj;
}

function _gameObjMappingToList(obj) {
    let list = [];
    
    for(let key in obj) {
        list.push(obj[key]);
    }
    
    return list;
}

elem_proto.levelEditor = async function(levelPath = null, blockTypes = [], entityTypes = []) {
    let level = (levelPath == null)? _makeEmptyLevel(): await loadJSON(levelPath);
    let cameraVelocity = 8 / 10000; // In screen quantile per millisecond...
    let cameraMaxZoomIn = 200;
    let cameraMaxZoomOut = 3000;
    let cameraScaleSpeed = 0.6; // In pixels per millisecond...
    
    
    function _deleteBlock(blockX, blockY, loadedChunk, chunkSize) {
        blockX = Math.floor(blockX % chunkSize);
        blockY = Math.floor(blockY % chunkSize);
        
        loadedChunk.blocks[blockX][blockY] = null;
    }
    
    function _addBlock(blockX, blockY, loadedChunk, chunkSize, blockSize, blockClass, sprites) {
        let cBlockX = Math.floor(blockX % chunkSize);
        let cBlockY = Math.floor(blockY % chunkSize);
                        
        loadedChunk.blocks[cBlockX][cBlockY] = new blockClass(Math.floor(blockX) * blockSize , Math.floor(blockY) * blockSize, blockSize, sprites);
    }
    
    function _deleteEntity() {
        
    }
    
    function _addEntity() {
        
    }
    
    class GameHoverBlock extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._sprite = sprites["_levelEditHover"].buildSprite();
            this._sprite.setAnimation("main");
            this._numChunks = null;
            this._chunkSize = null;
        }
        
        update(timeStep, gameState) {
            if(this._numChunks == null) {
                this._numChunks = gameState.level.numChunks;
                this._chunkSize = gameState.level.chunkSize;
            }
            
            [this._x, this._y] = gameState.camera.reverseTransform(gameState.mouseLocation);
            this._x = Math.floor(this._x / this._blockSize) * this._blockSize;
            this._y = Math.floor(this._y / this._blockSize) * this._blockSize;

            this._sprite.update(timeStep);
        }
        
        getBlockLocation() {
            let [x, y] = [this._x / this._blockSize, this._y / this._blockSize];
            
            if((x < 0) || (x >= this._numChunks[0] * this._chunkSize)) return [null, null];
            if((y < 0) || (y >= this._numChunks[1] * this._chunkSize)) return [null, null];
            
            return [x, y];
        }
        
        draw(canvas, painter, camera) {
            let [x, y, w, h] = camera.transformBox([this._x, this._y, this._blockSize, this._blockSize]);
            this._sprite.draw(painter, x, y, w, h);
        }
    }
    
    class GameSelectPanel extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._deleteSprite = sprites["_levelEditDelete"].buildSprite();
            this._itemSize = blockSize;
            this._hovered = null;
            this._selected = null;
            this._blocks = null;
            this._entities = null;
            this._sprites = sprites;
            this._width = 0;
            this._overbar = false;
        }
        
        _grabSelection(tileX, tileY, entityLen, blockLen) {
            switch(tileY) {
                case 0:
                    return ((tileX >= 0) && (tileX < entityLen + 1))? ["entity", tileX - 1]: null;
                case 1:
                    return ((tileX >= 0) && (tileX < blockLen + 1))? ["block", tileX - 1]: null;
            }
            
            return null;
        }
        
        update(timeStep, gameState) {
            if(this._blocks == null) {
                this._blocks = _gameObjMappingToList(gameState.blockTypes);
                this._entities = _gameObjMappingToList(gameState.entityTypes);
                this._loopupObj = {
                    "entity": this._entities,
                    "block": this._blocks
                }
            }
            
            let [x, y, w, h] = gameState.camera.getBounds();
            
            [this._x, this._y] = [x, y];
            this._width = w;
            
            this._itemSize = Math.min(w / this._blocks.length, this._blockSize, w / this._entities.length);
            
            let [mx, my] = gameState.camera.reverseTransform(gameState.mouseLocation);
            let [tileX, tileY] = [Math.floor((mx - x) / this._itemSize), Math.floor((my - y) / this._itemSize)];
            
            this._overbar = tileY < 2 && tileY >= 0;
            this._hovered = this._grabSelection(tileX, tileY, this._entities.length, this._blocks.length);

            if(gameState.mousePressed && this._hovered != null) {
                this._selected = this._hovered;
            }

            this._deleteSprite.update(timeStep);
        }
        
        getOverBar() {
            return this._overbar;
        }
        
        getSelection() {
            return (this._selected != null)? [this._selected[0], (this._selected[1] != -1)? this._loopupObj[this._selected[0]][this._selected[1]]: null]: null;
        }
        
        draw(canvas, painter, camera) {
            painter.fillStyle = "#dbdbdb";
            let [x, y, width, height] = camera.transformBox([this._x, this._y, this._width, this._itemSize * 2]);
            let step = height / 2;
            
            painter.fillRect(x, y, width, height);
            
            this._deleteSprite.draw(painter, x, y, step, step);
            this._deleteSprite.draw(painter, x, y + step, step, step);
            for(let i = 0; i < this._entities.length; i++) {
                (new this._entities[i](x + step * (i + 1), y, step, this._sprites)).drawPreview(canvas, painter, [x + step * (i + 1), y, step, step]);
            }
            for(let i = 0; i < this._blocks.length; i++) {
                (new this._blocks[i](x + step * (i + 1), y + step, step, this._sprites)).drawPreview(canvas, painter, [x + step * (i + 1), y + step, step, step]);
            }
            
            // Hover object....
            if(this._hovered != null) {
                painter.fillStyle = "rgba(46, 187, 230, 0.5)";
                painter.fillRect(x + (this._hovered[1] + 1) * step, (this._hovered[0] == "block")? y + step: y, step, step);
            }
            
            // Selected Object...
            if(this._selected != null) {
                painter.fillStyle = "rgba(27, 145, 181, 0.7)";
                painter.fillRect(x + (this._selected[1] + 1) * step, (this._selected[0] == "block")? y + step: y, step, step);
            }
        }
    }
    
    function update(timeStep, gameState) {
        let keys = gameState.keysPressed;
        let c = gameState.camera;
        let [cx, cy] = c.getCenterPoint();
        let cZoomStep = cameraScaleSpeed * timeStep;
        
        
        if("Minus" in keys) gameState.camera.setMinimumPixelsShown(Math.min(cameraMaxZoomOut, gameState.camera.getMinimumPixelsShown() + cZoomStep));
        if("Equal" in keys) gameState.camera.setMinimumPixelsShown(Math.max(cameraMaxZoomIn, gameState.camera.getMinimumPixelsShown() - cZoomStep));
        
        let stepAmt = cameraVelocity * timeStep * gameState.camera.getMinimumPixelsShown();
            
        if("ArrowUp" in keys || "KeyW" in keys) cy -= stepAmt;
        if("ArrowDown" in keys || "KeyS" in keys) cy += stepAmt;
        if("ArrowLeft" in keys || "KeyA" in keys) cx -= stepAmt;
        if("ArrowRight" in keys || "KeyD" in keys) cx += stepAmt;
        
        c.setCenterPoint([cx, cy]);
        c.update();
        
        gameState.hoverIndicator.update(timeStep, gameState);
        gameState.selectorBar.update(timeStep, gameState);
        
        gameState.loadedChunks = _manageChunks(
            level, gameState.camera, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, 
            gameState.sprites
        );
        
        // We check if user has clicked a location with a item in the toolbar selected...
        let [selLocX, selLocY] = gameState.hoverIndicator.getBlockLocation();
        let blockLoc = [Math.floor(selLocX), Math.floor(selLocY)];
        let selection = gameState.selectorBar.getSelection();
        if(
            (!gameState.clickWasDown || (gameState.lastBlockLocation.join() != blockLoc.join())) 
            && !gameState.selectorBar.getOverBar() && (selection != null) 
            && (selLocX != null) && gameState.mousePressed
        ) {
            console.log("Do!");
            let chunk = _findChunk(Math.floor(selLocX / level.chunkSize), Math.floor(selLocY / level.chunkSize), gameState.loadedChunks);
            if(chunk != null) {
                switch(selection[0]) {
                    case "block":
                        if(selection[1] != null) {
                            _addBlock(selLocX, selLocY, chunk, level.chunkSize, level.blockSize, selection[1], gameState.sprites);
                        }
                        else {
                            _deleteBlock(selLocX, selLocY, chunk, level.chunkSize);
                        }
                        break;
                    case "entity":
                        break;
                }
            }
        }
        
        gameState.lastBlockLocation = blockLoc;
        gameState.clickWasDown = gameState.mousePressed;
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
                    
                    let gx = x * level.chunkSize * level.blockSize + bx * level.blockSize;
                    let gy = y * level.chunkSize * level.blockSize + by * level.blockSize;
                    
                    let [canvX, canvY, canvW, canvH] = gameState.camera.transformBox([gx, gy, level.blockSize, level.blockSize]);
                    
                    painter.strokeStyle = "black";
                    painter.strokeRect(canvX, canvY, canvW, canvH);
                    
                    if(block != null) block.draw(canvas, painter, gameState.camera);
                }
            }
            
            for(let entity of chunk.entities) {
                entity.draw(canvas, painter, gameState.camera);
            }
        }
        
        let [selLocX, selLocY] = gameState.hoverIndicator.getBlockLocation();
        if((selLocX != null) && !gameState.selectorBar.getOverBar() && gameState.hoverIndicator.getLocation()) {
            gameState.hoverIndicator.draw(canvas, painter, gameState.camera);
        }
        
        gameState.selectorBar.draw(canvas, painter, gameState.camera);
    }
    
    function gameLoop(timeStep, gameState) {
        if(gameState.hoverIndicator == null) {
            gameState.hoverIndicator = new GameHoverBlock(0, 0, level.blockSize, gameState.sprites);
            gameState.selectorBar = new GameSelectPanel(0, 0, level.blockSize, gameState.sprites);
            gameState.level = level;
        }
        
        update(timeStep, gameState);
        draw(gameState.canvas, gameState.painter, gameState);
    }
    
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(entityTypes);
    gameState.blockTypes = _gameObjListToMapping(blockTypes);
    gameState.loadedChunks = [];
    gameState.lastBlockLocation = null;
    gameState.clickWasDown = false;
    
    let data = {
        sprites: {
            "_levelEditHover": {
                "image": "levelEdit/hover.png",
                "animations": {
                    "main": {
                        "speed": 150
                    }
                }
            },
            "_levelEditDelete": {
                "image": "levelEdit/deleteSelected.png",
            }
        }
    };
    
    this.makeBaseGame(gameLoop, gameState, data);
}
