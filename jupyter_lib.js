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
elem_proto.getCanvasAndPainter = function(width, height) {
    let jqCanvas = $.parseHTML("<canvas width='" + width + "' height='" + height +  "' style='width: 100%;'>");
    let painter = jqCanvas[0].getContext("2d");
    
    this.append(jqCanvas);
    
    return [jqCanvas[0], painter];
};

elem_proto.makeGame = function(width, height, gameLoop) {
    
};
