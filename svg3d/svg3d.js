(function(window) {

    if (window.svg3d === undefined) {
        window.svg3d = function() {};
    }

    function Shape(domNode) {
        this.domNode = domNode;
        this.assignSetNormal();
    }
    /*
get next coord in the string
*/
    var COORD = new RegExp("^ *,? *(-?[\\d.]+([eE][-+]?\\d+)?) ?");
    Shape.prototype.getCoord = function() {
        var coord = COORD.exec(this.coords.substr(this.index));
        if (coord) {
            this.index += coord[0].length;
            return parseFloat(coord[1]);
        }
        return undefined;
    };

    Shape.prototype.assignSetNormal = function() {
        switch (svg3d.sortAlgo) {
            case svg3d.NONE:
                this.setNormal = function() {};
                break;
            case svg3d.AVERAGE_Z:
                this.setNormal = setNormal_averageZ;
                this.z = 0;
                break;
            case svg3d.ALL_TO_ALL:
                this.setNormal = setNormal_default;
                this.normal = [0, 0, 0];
                this.position = [0, 0, 0];
                break;
            default:
                this.setNormal = setNormal_default;
                this.normal = [0, 0, 0];
                this.position = [0, 0, 0];
                break;
        }
    }

    /****************************************
    **************** path tag ***************
    *****************************************/
    Path.prototype = new Shape();
    Path.constructor = Path;

    function Path(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            this.coords = domNode.getAttribute("d");
        }
    }

    function getPt2d(pt3d, firstCoord) {
        pt3d[0] = firstCoord;
        pt3d[1] = this.getCoord();
        pt3d[2] = 0;
    }

    function getPt2dCumul(pt3d, firstCoord, relativeOriginPt) {
        pt3d[0] = relativeOriginPt[0] + firstCoord;
        pt3d[1] = relativeOriginPt[1] + this.getCoord();
    }

    function getXZ2d(pt3d, firstCoord) {
        pt3d[0] = firstCoord;
        pt3d[2] = 0;
    }

    function getXZ2dCumul(pt3d, firstCoord) {
        pt3d[0] += firstCoord;
    }

    function getYZ2d(pt3d, firstCoord) {
        pt3d[1] = firstCoord;
        pt3d[2] = 0;
    }

    function getYZ2dCumul(pt3d, firstCoord) {
        pt3d[1] += firstCoord;
    }

    /*
     *  M = moveto
     * L = lineto
     * H = horizontal lineto
     * V = vertical lineto
     * C = curveto
     * S = smooth curveto
     * Q = quadratic Belzier curve
     * T = smooth quadratic Belzier curveto
     * A = elliptical Arc
     * Z = closepath
     */
    function transformPath(matrixArray) {
        this.index = 0;
        var pt3d = [0, 0, 0];
        var points = [];
        var newD = "";
        var ch, coord, x_axis_rotation, large_arc_flag, sweep_flag, isAbsolute, relativeOriginRefreshAt;
        var pathLength = this.coords.length;
        for (this.index = 0; this.index < pathLength;) {
            ch = this.coords.charAt(this.index);
            isAbsolute = true;
            relativeOriginRefreshAt = 0;
            switch (ch) {
                case "c":
                    // ends at 3
                    relativeOriginRefreshAt++;
                case "s":
                case "q":
                    // ends at 2
                    relativeOriginRefreshAt++;
                case "m":
                case "l":
                case "t":
                    // ends at 1
                    relativeOriginRefreshAt++;
                    var relativeOriginPt = cloneArray(pt3d);
                    var relativeOriginIndex = 0;
                    ch = ch.toUpperCase();
                    //(x y)+ or s(x2 y2 x y)+ or q(x1 y1 x y)+ or c(x1 y1 x2 y2 x y)+
                    this.index++;
                    for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                        this.getPointCumul(pt3d, coord, relativeOriginPt);
                        relativeOriginIndex++;
                        if (relativeOriginIndex === relativeOriginRefreshAt) {
                            relativeOriginPt = cloneArray(pt3d);
                            relativeOriginIndex = 0;
                        }
                        newD += ch + transformAndStore(pt3d, matrixArray, points);
                        //if the loop is executed more than once, then a comma is dumped between points
                        ch = ",";
                    }
                    relativeOriginRefreshAt = 0;
                    break;
                case "M":
                case "L":
                case "C":
                case "S":
                case "Q":
                case "T":
                    //(x y)+ or s(x2 y2 x y)+ or q(x1 y1 x y)+ or c(x1 y1 x2 y2 x y)+
                    this.index++;
                    for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                        this.getPoint(pt3d, coord);
                        newD += ch + transformAndStore(pt3d, matrixArray, points);
                        //if the loop is executed more than once, then a comma is dumped between points
                        ch = ",";
                    }
                    break;
                case "h":
                    isAbsolute = false;
                case "H":
                    // x+
                    this.index++;
                    //changes h or H into L
                    ch = "L";
                    //the former y will be kept
                    for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                        if (isAbsolute) {
                            this.getXZ(pt3d, coord);
                        } else {
                            this.getXZCumul(pt3d, coord);
                        }
                        newD += ch + transformAndStore(pt3d, matrixArray, points);
                        //if the loop is executed more than once, then a comma is dumped between points
                        ch = ",";
                    }
                    break;
                case "v":
                    isAbsolute = false;
                case "V":
                    // y+
                    this.index++;
                    //changes v or V into L
                    ch = "L";
                    //the former x will be kept
                    for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                        if (isAbsolute) {
                            this.getYZ(pt3d, coord);
                        } else {
                            this.getYZCumul(pt3d, coord);
                        }
                        newD += ch + transformAndStore(pt3d, matrixArray, points);
                        //if the loop is executed more than once, then a comma is dumped between points
                        ch = ",";
                    }
                    break;
                case "a":
                    isAbsolute = false;
                    ch = ch.toUpperCase();
                case "A":
                    //(rx ry x-axis-rotation large-arc-flag sweep-flag x y)+
                    this.index++;
                    for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                        var oldPt3d = cloneArray(pt3d);
                        transformPoint(matrixArray, oldPt3d);
                        svg3d.projectPoint3d(oldPt3d);
                        // the pt3d retrieved here is radial so it is relative
                        this.getPointCumul(pt3d, coord, pt3d);
                        //does not modify pt3d for support of relative coords
                        var newPt3d = cloneArray(pt3d);
                        transformPoint(matrixArray, newPt3d);
                        svg3d.projectPoint3d(newPt3d);
                        var rx = newPt3d[0] - oldPt3d[0];
                        var ry = newPt3d[1] - oldPt3d[1];
                        newD += ch + Math.abs(rx) + "," + Math.abs(ry);
                        //TODO modify x_axis_rotation with rotation on y (-rotY % (2*Math.PI)) * 360 / (2*Math.PI)
                        x_axis_rotation = this.getCoord();
                        large_arc_flag = this.getCoord();
                        sweep_flag = this.getCoord();
                        newD += " " + x_axis_rotation + " " + large_arc_flag + " " + sweep_flag + " ";
                        if (isAbsolute) {
                            this.getPoint(pt3d, this.getCoord());
                        } else {
                            this.getPointCumul(pt3d, this.getCoord(), oldPt3d);
                        }
                        newD += transformAndStore(pt3d, matrixArray, points);
                        //if the loop is executed more than once, then a comma is dumped between points
                        ch = ",";
                    }
                    break;
                case "z":
                case "Z":
                    this.index++;
                    newD += ch;
                    break;
                default:
                    // for invalid chars
                    this.index++;
                    break;
            }

        }
        this.setNormal(points);
        this.domNode.setAttribute("d", newD);
    }

    Path.prototype.transform = transformPath;
    Path.prototype.getPoint = getPt2d;
    Path.prototype.getPointCumul = getPt2dCumul;
    Path.prototype.getXZ = getXZ2d;
    Path.prototype.getXZCumul = getXZ2dCumul;
    Path.prototype.getYZ = getYZ2d;
    Path.prototype.getYZCumul = getYZ2dCumul;
    Path.prototype.cloneOn = function(domNode) {
        domNode.setAttribute("d", this.coords);
        var clone = new Path(domNode);
        return clone;
    };

    Path3d.prototype = new Path();
    Path3d.constructor = Path3d;

    function Path3d(domNode) {
        Path.call(this, domNode);
    }

    function getPt3d(pt3d, firstCoord) {
        pt3d[0] = firstCoord;
        pt3d[1] = this.getCoord();
        pt3d[2] = this.getCoord();
    }
    /*
get next 3d or 2d coordinates in the string and adds it to current point
*/
    function getPt3dCumul(pt3d, firstCoord, relativeOriginPt) {
        pt3d[0] = relativeOriginPt[0] + firstCoord;
        pt3d[1] = relativeOriginPt[1] + this.getCoord();
        pt3d[2] = relativeOriginPt[2] + this.getCoord();
    }

    function getXZ3d(pt3d, firstCoord) {
        pt3d[0] = firstCoord;
        pt3d[2] = this.getCoord();
    }

    function getXZ3dCumul(pt3d, firstCoord) {
        pt3d[0] += firstCoord;
        pt3d[2] += this.getCoord();
    }

    function getYZ3d(pt3d, firstCoord) {
        pt3d[1] = firstCoord;
        pt3d[2] = this.getCoord();
    }

    function getYZ3dCumul(pt3d, firstCoord) {
        pt3d[1] += firstCoord;
        pt3d[2] += this.getCoord();
    }
    Path3d.prototype.getPoint = getPt3d;
    Path3d.prototype.getPointCumul = getPt3dCumul;
    Path3d.prototype.getXZ = getXZ3d;
    Path3d.prototype.getXZCumul = getXZ3dCumul;
    Path3d.prototype.getYZ = getYZ3d;
    Path3d.prototype.getYZCumul = getYZ3dCumul;
    Path3d.prototype.cloneOn = function(domNode) {
        domNode.setAttribute("d", this.coords);
        var clone = new Path3d(domNode);
        return clone;
    };


    /****************************************
    **************** rect tag ***************
    *****************************************/
    Rect.prototype = new Path();
    Rect.constructor = Path;

    /*
transfoms the rect to a Path that can be rotated. The rounded edges are transformed to a C (cubic Bezier curve)
    */
    function rectToPath() {
        var maxX = this.x + this.width;
        var maxY = this.y + this.height;
        var x = this.x + 2 * this.rx;
        var d = "M" + x + "," + this.y;
        x = maxX - 2 * this.rx;
        d += "H" + x;
        var y = this.y + 2 * this.ry;
        if (this.rx || this.ry) {
            d += "C" + maxX + "," + this.y + "," + maxX + "," + this.y + "," + maxX + "," + y;
        }
        y = maxY - 2 * this.ry;
        d += "V" + y;
        if (this.rx || this.ry) {
            d += "C" + maxX + "," + maxY + "," + maxX + "," + maxY + "," + x + "," + maxY;
        }
        x = this.x + 2 * this.rx;
        d += "H" + x;
        if (this.rx || this.ry) {
            d += "C" + this.x + "," + maxY + "," + this.x + "," + maxY + "," + this.x + "," + y;
        }
        y = this.y + 2 * this.ry;
        d += "V" + y;
        if (this.rx || this.ry) {
            d += "C" + this.x + "," + this.y + "," + this.x + "," + this.y + "," + x + "," + this.y;
        }
        return d;
    }
    Rect.prototype.toPath = rectToPath;

    function Rect(domNode) {
        if (domNode) {
            this.x = parseFloat(domNode.getAttribute("x"));
            this.y = parseFloat(domNode.getAttribute("y"));
            this.width = parseFloat(domNode.getAttribute("width"));
            this.height = parseFloat(domNode.getAttribute("height"));
            var rxAtt = domNode.getAttribute("rx");
            if (rxAtt) {
                this.rx = parseFloat(rxAtt);
            } else {
                this.rx = 0;
            }
            var ryAtt = domNode.getAttribute("ry");
            if (ryAtt) {
                this.ry = parseFloat(ryAtt);
            } else {
                this.ry = 0;
            }
            this.coords = this.toPath();
            var newDomNode = document.createElementNS("http://www.w3.org/2000/svg", "path");
            var i = domNode.attributes.length;
            while (i--) {
                var att = domNode.attributes.item(i);
                newDomNode.setAttribute(att.name, att.value);
            }
            for (var node = getFirstChildElement(domNode); node; node = getFirstChildElement(domNode)) {
                newDomNode.appendChild(node);
            }
            newDomNode.setAttribute("d", this.coords);
            Path.call(this, newDomNode);
            domNode.parentNode.insertBefore(newDomNode, domNode);
            domNode.style.display = "none";
        }
    }

    Rect.prototype.transform = transformPath;
    Rect.prototype.getPoint = getPt2d;
    Rect.prototype.getPointCumul = getPt2dCumul;
    Rect.prototype.getXZ = getXZ2d;
    Rect.prototype.getXZCumul = getXZ2dCumul;
    Rect.prototype.getYZ = getYZ2d;
    Rect.prototype.getYZCumul = getYZ2dCumul;
    // The original domNode has not been modified, the domNode passed here must be the hidden domNode
    Rect.prototype.cloneOn = function(domNode) {
        var clone = new Rect(domNode);
        return clone;
    };

    /****************************************
    ************** polyline tag *************
    *****************************************/
    Polyline.prototype = new Shape();
    Polyline.constructor = Shape;

    function Polyline(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            this.coords = domNode.getAttribute("points");
        }
    }

    function transformPolyline(matrixArray) {
        this.index = 0;
        var pt3d = [0, 0, 0];
        var points = [];
        var newPoints = "";
        var coord = 0;
        var ch = "";
        var pointsLength = this.coords.length;
        for (this.index = 0; this.index < pointsLength;) {
            for (coord = this.getCoord(); coord !== undefined; coord = this.getCoord()) {
                this.getPoint(pt3d, coord);
                newPoints += ch + transformAndStore(pt3d, matrixArray, points);
                //if the loop is executed more than once, then a comma is dumped between points
                ch = ",";
            }
        }
        this.setNormal(points);
        this.domNode.setAttribute("points", newPoints);
    }

    Polyline.prototype.transform = transformPolyline;
    Polyline.prototype.getPoint = getPt2d;
    Polyline.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("points", this.coords);
        var clone = new Polyline(domNode);
        return clone;
    };

    Polyline3d.prototype = new Polyline();
    Polyline3d.constructor = Polyline;

    function Polyline3d(domNode) {
        Polyline.call(this, domNode);
    }

    Polyline3d.prototype.getPoint = getPt3d;
    Polyline3d.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("points", this.coords);
        var clone = new Polyline3d(domNode);
        return clone;
    };

    /****************************************
    *************** circle tag **************
    *****************************************/
    Circle.prototype = new Shape();
    Circle.constructor = Shape;

    function Circle(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            this.radius = domNode.getAttribute("r");
            this.center = [0, 0, 0];
            this.center[0] = domNode.getAttribute("cx");
            this.center[1] = domNode.getAttribute("cy");
            this.center[2] = 0;
        }
    }

    function transformCircle(matrixArray) {
        var pt3d = cloneArray(this.center);
        transformPoint(matrixArray, pt3d);
        if (svg3d.sortAlgo !== svg3d.NONE) {
            this.setNormal([pt3d]);
        }
        svg3d.projectPoint3d(pt3d);
        //reduces or increases the radius of the circle (sphere)
        var perspectiveRatio = svg3d.focalDistance / (svg3d.focalDistance + (pt3d[2] / svg3d.zRatio));
        var newRadius = this.radius * perspectiveRatio;
        this.domNode.setAttribute("cx", pt3d[0]);
        this.domNode.setAttribute("cy", pt3d[1]);
        this.domNode.setAttribute("r", newRadius);
    }

    Circle.prototype.transform = transformCircle;
    Circle.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("r", this.radius);
        this.domNode.setAttribute("cx", this.center[0]);
        this.domNode.setAttribute("cy", this.center[1]);
        var clone = new Circle(domNode);
        return clone;
    };

    Circle3d.prototype = new Circle();
    Circle3d.constructor = Circle;

    function Circle3d(domNode) {
        Circle.call(this, domNode);
        if (domNode) {
            this.center[2] = domNode.getAttribute("z:cz");
        }
    }

    Circle3d.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("r", this.radius);
        this.domNode.setAttribute("cx", this.center[0]);
        this.domNode.setAttribute("cy", this.center[1]);
        this.domNode.setAttribute("z:cz", this.center[2]);
        var clone = new Circle3d(domNode);
        return clone;
    };

    /****************************************
    **************** Use tag ****************
    *****************************************/
    Use.prototype = new Shape();
    Use.constructor = Shape;

    function Use(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            this.translation = [0, 0, 0];
            this.translation[0] = parseFloat(domNode.getAttribute("x"));
            this.translation[1] = parseFloat(domNode.getAttribute("y"));
        }
    }

    function transformUse(matrixArray) {
        var pt3d = cloneArray(this.translation);
        var symbolPosition = cloneArray(this.domNode.svg3dSymbol.svg3dElem.svg3dshape.position);
        pt3d[0] += symbolPosition[0];
        pt3d[1] += symbolPosition[1];
        pt3d[2] += symbolPosition[2];
        transformPoint(matrixArray, pt3d);
        if (svg3d.sortAlgo !== svg3d.NONE) {
            this.setNormal([pt3d]);
        }
        svg3d.projectPoint3d(pt3d);
        svg3d.projectPoint3d(symbolPosition);
        this.domNode.setAttribute("x", pt3d[0] - symbolPosition[0]);
        this.domNode.setAttribute("y", pt3d[1] - symbolPosition[1]);
    }

    Use.prototype.transform = transformUse;
    Use.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("x", this.translation[0]);
        this.domNode.setAttribute("y", this.translation[1]);
        var clone = new Use(domNode);
        return clone;
    };

    /****************************************
    *************** image tag ***************
    *****************************************/

    /*
    - 3d transform and project 3 points of the shape
    - reverse calculate 2d matrix to apply on shape :
    matrix is       matrix(0,0) matrix(1,0) matrix(2,0)
                (   matrix(0,1) matrix(1,1) matrix(2,1) )
                    0           0           1
    x new = matrix(0,0) * x previous + matrix(1,0) * y previous + matrix(2,0)
    y new = matrix(0,1) * x previous + matrix(1,1) * y previous + matrix(2,1)
    let us take 3 corners as transformation points :
    - upper left corner (x1, y1) -> (x1new, y1new)
    - upper right corner (x2 = x + width, y2 = y1) -> (x2new, y2new)
    - lower right corner (x3 = x2 = x1 + with, y3 = y2 + height = y1 + height) -> (x3new, y3new)
    matrix(0, 0) = ( (x1new - x2new) * (y2 - y3) - (x2new - x3new) * (y1 - y2) ) / ( (x1 - x2) * (y2 - y3) - (x2 - x3) * (y1 - y2) )
                 = (x1new - x2new) * (-height) / (-width) * (-height)
                 = (x2new - x1new) / width
    matrix(1, 0) = (x3new - x2new) / height
    In order to pass from matrix(*, 0) to matrix(*, 1) x new becomes y new
    matrix(0, 1) = (y2new - y1new) / width
    matrix(1, 1) = (y3new - y2new) / height
    matrix(2, 0) = ( (x1new * x2 - x2new * x1) * (y2 * x3 - y3 * x2) ) - ( (x2new * x3 - x3new * x2) * (y1 * x2 - y2 * x1) ) /
                        ( (x2 - x1) * (y2 * x3 - y3 * x2) - (x3 - x2) * (y1 * x2 - y2 * x1) )
        where y2 * x3 - y3 * x2 = x2 * (y2 - y3) = x2 * (-height)
              y1 * x2 - y2 * x1 = y1 * (x2 - x1) = y1 * width
              x3 - x2 = 0
    so
    matrix(2, 0) = ( x2 * height * (x2new * x1 - x1new * x2) - y1 * width * (x2new * x3 - x3new * x2) ) / width * x2 * (-height)
                 = ( height * (x1 + width) * (x2new * x1 - x1new * (x1 + width) ) - width * y1 * (x1 + width) * (x2new - x3new) ) / width * x2 * (-height)
    matrix(2, 1) = ( height * (x1 + width) * (y2new * x1 - y1new * (x1 + width) ) - width * y1 * (x1 + width) * (y2new - y3new) ) / width * x2 * (-height)
    */
    function setMatrixTransform(matrixArray, pt3d_upperLeft, pt3d_upperRight, pt3d_lowerRight) {
        transformPoint(matrixArray, pt3d_upperLeft);
        transformPoint(matrixArray, pt3d_upperRight);
        transformPoint(matrixArray, pt3d_lowerRight);
        if (svg3d.sortAlgo !== svg3d.NONE) {
            this.setNormal([pt3d_upperLeft, pt3d_upperRight, pt3d_lowerRight]);
        }
        svg3d.projectPoint3d(pt3d_upperLeft);
        svg3d.projectPoint3d(pt3d_upperRight);
        svg3d.projectPoint3d(pt3d_lowerRight);
        //matrix(0, 0) = (x2new - x1new) / width
        matrix00 = (pt3d_upperRight[0] - pt3d_upperLeft[0]) / this.width;
        //matrix(0, 1) = (y2new - y1new) / width
        matrix01 = (pt3d_upperRight[1] - pt3d_upperLeft[1]) / this.width;
        //matrix(1, 0) = (x3new - x2new) / height
        matrix10 = (pt3d_lowerRight[0] - pt3d_upperRight[0]) / this.height;
        //matrix(1, 1) = (y3new - y2new) / height
        matrix11 = (pt3d_lowerRight[1] - pt3d_upperRight[1]) / this.height;
        //matrix(2, 0) = ( h * (x1 + w) * (x2new * x1 - x1new * (x1 + w) ) - w * y1 * (x1 + w) * (x2new - x3new) ) / w * x2 * (-h)
        var x2 = this.x + this.width;
        // width * x2 * (-height)
        var divider = -(this.width * x2 * this.height);
        matrix20 = ( this.height * x2 * (pt3d_upperRight[0] * this.x - pt3d_upperLeft[0] * x2 ) - this.width * this.y * x2 * (pt3d_upperRight[0] - pt3d_lowerRight[0]) ) / divider;
        //matrix(2, 1) = ( h * (x1 + w) * (y2new * x1 - y1new * (x1 + w) ) - w * y1 * (x1 + w) * (y2new - y3new) ) / w * x2 * (-h)
        matrix21 = ( this.height * x2 * (pt3d_upperRight[1] * this.x - pt3d_upperLeft[1] * x2 ) - this.width * this.y * x2 * (pt3d_upperRight[1] - pt3d_lowerRight[1]) ) / divider;
        var newTransformAttr = "matrix(" + matrix00 + ", " + matrix01 + ", " + matrix10 + ", " + matrix11 + ", " + matrix20 + ", " + matrix21 + ")";
        if (this.transformAttr) {
            newTransformAttr = newTransformAttr + " " + this.transformAttr;
        }
        this.domNode.setAttribute("transform", newTransformAttr);
    }
    
    function transformRectangleShape(matrixArray) {
        var pt3d_upperLeft = [];
        pt3d_upperLeft[0] = this.x;
        pt3d_upperLeft[1] = this.y;
        pt3d_upperLeft[2] = this.z;
        var pt3d_upperRight = [];
        pt3d_upperRight[0] = this.x + this.width;
        pt3d_upperRight[1] = this.y;
        pt3d_upperRight[2] = this.z;
        var pt3d_lowerRight = [];
        pt3d_lowerRight[0] = this.x + this.width;
        pt3d_lowerRight[1] = this.y + this.height;
        pt3d_lowerRight[2] = this.z;
        this.setMatrixTransform(matrixArray, pt3d_upperLeft, pt3d_upperRight, pt3d_lowerRight);
    }
    
    Image.prototype = new Shape();
    Image.constructor = Shape;

    function Image(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            this.x = parseFloat(domNode.getAttribute("x"));
            this.y = parseFloat(domNode.getAttribute("y"));
            this.width = parseFloat(domNode.getAttribute("width"));
            this.height = parseFloat(domNode.getAttribute("height"));
            this.z = 0;
            this.transformAttr = domNode.getAttribute("transform");
        }
    }

    Image.prototype.setMatrixTransform = setMatrixTransform;
    Image.prototype.transform = transformRectangleShape;
    Image.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("x", this.x);
        this.domNode.setAttribute("y", this.y);
        this.domNode.setAttribute("width", this.width);
        this.domNode.setAttribute("height", this.height);
        var clone = new Image(domNode);
        return clone;
    };
	
	Image3d.prototype = new Image();
    Image3d.constructor = Image;

    function Image3d(domNode) {
        Image.call(this, domNode);
        if (domNode) {
            this.z = parseFloat(domNode.getAttribute("z:z"));
        }
    }

    Image3d.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("x", this.x);
        this.domNode.setAttribute("y", this.y);
        this.domNode.setAttribute("z:z", this.z);
        this.domNode.setAttribute("width", this.width);
        this.domNode.setAttribute("height", this.height);
        var clone = new Image3d(domNode);
        return clone;
    };
    
    /****************************************
    *************** text tag ***************
    *****************************************/
    Text.prototype = new Shape();
    Text.constructor = Shape;

    function Text(domNode) {
        Shape.call(this, domNode);
        if (domNode) {
            var widthAttr = domNode.getAttribute("width");
            if (widthAttr) {
                this.width = parseFloat(widthAttr);
            } else {
                this.width = 200;
            }
            var heightAttr = domNode.getAttribute("height");
            if (heightAttr) {
                this.height = parseFloat(heightAttr);
            } else {
                this.height = 20;
            }
            this.x = parseFloat(domNode.getAttribute("x"));
			//Specified point in SVG text is the lower left corner.
			this.y_orig = parseFloat(domNode.getAttribute("y"));
            this.y = this.y_orig - this.height;
            this.z = 0;
            this.transformAttr = domNode.getAttribute("transform");
        }
    }
    
    Text.prototype.setMatrixTransform = setMatrixTransform;
    Text.prototype.transform = transformRectangleShape;
    Text.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("x", this.x);
		//Specified point in SVG text is the lower left corner.
        this.domNode.setAttribute("y", this.y_orig);
        this.domNode.setAttribute("width", this.width);
        this.domNode.setAttribute("height", this.height);
        var clone = new Text(domNode);
        return clone;
    };

    Text3d.prototype = new Text();
    Text3d.constructor = Text;

    function Text3d(domNode) {
        Text.call(this, domNode);
        if (domNode) {
            this.z = parseFloat(domNode.getAttribute("z:z"));
        }
    }

    Text3d.prototype.cloneOn = function(domNode) {
        this.domNode.setAttribute("x", this.x);
		//Specified point in SVG text is the lower left corner.
        this.domNode.setAttribute("y", this.y_orig);
        this.domNode.setAttribute("z:z", this.z);
        this.domNode.setAttribute("width", this.width);
        this.domNode.setAttribute("height", this.height);
        var clone = new Text3d(domNode);
        return clone;
    };
    
    /****************************************
    ***************** g tag *****************
    *****************************************/
    Group.prototype = new Shape();
    Group.constructor = Shape;

    function Group(domNode, subShapes) {
        Shape.call(this, domNode);
        if (subShapes === undefined) {
            this.subShapes = [];
            addShapes(this.subShapes, domNode);
        } else {
            this.subShapes = subShapes;
        }
    }

    function addShapes(shapes, parentNode) {
        if (parentNode) {
            for (var node = getFirstChildElement(parentNode); node; node = getNextSiblingElement(node)) {
                var shape = svg3d.shapeFactory(node);
                if (shape) {
                    shapes.push(shape);
                }
            }
        }
    }

    function addClonedSubShapes(clonedSubShapes, subShapes, parentNode) {
        if (parentNode) {
            for (var node = getFirstChildElement(parentNode), i = 0; node; node = getNextSiblingElement(node), i++) {
                if (subShapes[i] !== undefined) {
                    var clonedSubShape = subShapes[i].cloneOn(node);
                    clonedSubShapes.push(clonedSubShape);
                }
            }
        }
    }

    Group.prototype.transform = function(matrixArray) {
        var i = this.subShapes.length;
        while (i--) {
            this.subShapes[i].transform(matrixArray);
        }
        this.setNormal();
    };

    Group.prototype.cloneOn = function(domNode) {
        var clonedSubShapes = [];
        addClonedSubShapes(clonedSubShapes, this.subShapes, domNode);
        var clone = new Group(domNode, clonedSubShapes);
        return clone;
    };

    Group.prototype.assignSetNormal = function() {
        switch (svg3d.sortAlgo) {
            case svg3d.NONE:
                this.setNormal = function() {};
                break;
            case svg3d.AVERAGE_Z:
                this.setNormal = function() {
                    // z will be the average z of all the shapes contained in that g tag
                    var sumZ = 0,
                        i = this.subShapes.length;
                    while (i--) {
                        sumZ += this.subShapes[i].z;
                    }
                    this.z = sumZ / this.subShapes.length;
                };
                this.z = 0;
                break;
            case svg3d.ALL_TO_ALL:
                this.setNormal = this.setPositionNormalAverage;
                this.normal = [0, 0, 0];
                this.position = [0, 0, 0];
                break;
            default:
                this.setNormal = this.setPositionNormalAverage;
                this.normal = [0, 0, 0];
                this.position = [0, 0, 0];
                break;
        }
    };

    Group.prototype.setPositionNormalAverage = function(points) {
        // position and normal will be the average position and normal of all the shapes contained in that g tag
        var sumPosition = [0, 0, 0],
            sumNormal = [0, 0, 0],
            i = this.subShapes.length;
        while (i--) {
            sumPosition[0] += this.subShapes[i].position[0];
            sumPosition[1] += this.subShapes[i].position[1];
            sumPosition[2] += this.subShapes[i].position[2];
            sumNormal[0] += this.subShapes[i].normal[0];
            sumNormal[1] += this.subShapes[i].normal[1];
            sumNormal[2] += this.subShapes[i].normal[2];
        }
        this.position[0] = sumPosition[0] / this.subShapes.length;
        this.position[1] = sumPosition[1] / this.subShapes.length;
        this.position[2] = sumPosition[2] / this.subShapes.length;
        this.normal[0] = sumNormal[0] / this.subShapes.length;
        this.normal[1] = sumNormal[1] / this.subShapes.length;
        this.normal[2] = sumNormal[2] / this.subShapes.length;
    };

    function setNormal_averageZ(points) {
        var i = points.length - 1;
        var sumZ = points[i][2];
        while (i--) {
            sumZ += points[i][2];
        }
        this.z = sumZ / points.length;
    }

    function setNormal_default(points) {
        switch (points.length) {
            case 0:
                this.normal[0] = 0;
                this.normal[1] = 0;
                this.normal[2] = 0;
                this.position = [0, 0, 0];
                break;
            case 1:
                //surface is parallel to ( x, y ) plan
                this.normal[0] = 0;
                this.normal[1] = 0;
                this.normal[2] = 1;
                this.position = cloneArray(points[0]);
                break;
            case 2:
                //surface is orthogonal to the segment
                this.normal[0] = points[1][0] - points[0][0];
                this.normal[1] = points[1][1] - points[0][1];
                this.normal[2] = points[1][2] - points[0][2];
                this.position = cloneArray(points[0]);
                break;
                //as soon we have 3 points
            default:
                //calculates the position of the surface, also avoids the problem of very small normals
                var i = points.length - 1;
                this.position[0] = points[i][0];
                this.position[1] = points[i][1];
                this.position[2] = points[i][2];
                while (i--) {
                    this.position[0] += points[i][0];
                    this.position[1] += points[i][1];
                    this.position[2] += points[i][2];
                }
                this.position[0] = this.position[0] / points.length;
                this.position[1] = this.position[1] / points.length;
                this.position[2] = this.position[2] / points.length;
                //this.position will be used as third point, still in order to avoid problem of very small normals (1e-15 ...)
                // in order to calculate normal
                // u=(ux, uy, uz) et v=(vx, vy, vz)
                //                (  uy vz - uz vy )
                //  u /\ v =      (  uz vx - ux vz   )
                //                (  ux vy - uy vx   )
                var ux = points[1][0] - points[0][0];
                var uy = points[1][1] - points[0][1];
                var uz = points[1][2] - points[0][2];
                var vx = this.position[0] - points[0][0];
                var vy = this.position[1] - points[0][1];
                var vz = this.position[2] - points[0][2];
                this.normal[0] = uy * vz - uz * vy;
                this.normal[1] = uz * vx - ux * vz;
                this.normal[2] = ux * vy - uy * vx;
                break;
        }
    }

    svg3d.shapeFactory = function(domNode) {
        var returnedShape;
        var threeD = domNode.getAttribute("z:threeD");
        if (threeD && threeD === "true") {
            threeD = true;
        } else {
            threeD = false;
        }
        switch (domNode.localName) {
            case "path":
                if (threeD) {
                    returnedShape = new Path3d(domNode);
                } else {
                    returnedShape = new Path(domNode);
                }
                break;
            case "g":
                returnedShape = new Group(domNode);
                break;
            case "rect":
                returnedShape = new Rect(domNode);
                break;
            case "polyline":
                if (threeD) {
                    returnedShape = new Polyline3d(domNode);
                } else {
                    returnedShape = new Polyline(domNode);
                }
                break;
            case "circle":
                if (threeD) {
                    returnedShape = new Circle3d(domNode);
                } else {
                    returnedShape = new Circle(domNode);
                }
                break;
            case "use":
                if (threeD) {
                    returnedShape = new Use3d(domNode);
                } else {
                    returnedShape = new Use(domNode);
                }
                break;
            case "image":
				if (threeD) {
					returnedShape = new Image3d(domNode);
				} else {
					returnedShape = new Image(domNode);
				}
                break;
            case "text":
                if (threeD) {
                    returnedShape = new Text3d(domNode);
                } else {
                    returnedShape = new Text(domNode);
                }
                break;
            default:
                return;
        }
        return returnedShape;
    }

    function transformAndStore(pt3d, matrixArray, points) {
        //does not modify pt3d for support of relative coords
        var newPt3d = cloneArray(pt3d);
        if (newPt3d[2] === undefined) {
            newPt3d[2] = 0;
        }
        transformPoint(matrixArray, newPt3d);
        //points are stored before projection
        if (svg3d.sortAlgo !== svg3d.NONE) {
            points.push(cloneArray(newPt3d));
        }
        svg3d.projectPoint3d(newPt3d);
        return newPt3d[0] + "," + newPt3d[1];
    }

    // multiplies by matrix from last to first
    function transformPoint(matrixArray, pt3d) {
        //optimization ?
        var newx = 0;
        var newy = 0;
        var newz = 0;
        var i = matrixArray.length;
        while (i--) {
            var matrix = matrixArray[i];
            //must keep the old values
            newx = pt3d[0] * matrix[0] + pt3d[1] * matrix[1] + pt3d[2] * matrix[2] + matrix[3];
            newy = pt3d[0] * matrix[4] + pt3d[1] * matrix[5] + pt3d[2] * matrix[6] + matrix[7];
            newz = pt3d[0] * matrix[8] + pt3d[1] * matrix[9] + pt3d[2] * matrix[10] + matrix[11];
            pt3d[0] = newx;
            pt3d[1] = newy;
            pt3d[2] = newz;
        }
    }

    /*
    A point located at coordinates (svg3d.xOrigin, svg3d.yOrigin, z) is projected at (svg3d.xInfinite, svg3d.yInfinite).
    A point with z = infinite is also projected at (svg3d.xInfinite, svg3d.yInfinite).
    A point (x, y, 0) is projected at (x - svg3d.xOrigin + svg3d.xInfinite, y - svg3d.yOrigin + svg3d.yInfinite).

    */
    svg3d.projectPoint3d = function(pt3d) {
        var perspectiveRatio = svg3d.focalDistance / (svg3d.focalDistance + (pt3d[2] / svg3d.zRatio));
        pt3d[0] = (pt3d[0] - svg3d.xOrigin) * perspectiveRatio + svg3d.xInfinite;
        pt3d[1] = (pt3d[1] - svg3d.yOrigin) * perspectiveRatio + svg3d.yInfinite;
    }

    // Sets the specified matrix to a rotation matrix
    svg3d.setAnglesRotationMatrix = function(rotx, roty, rotz) {
        // Assuming the angles are in radians
        var cx = Math.cos(rotx);
        var sx = Math.sin(rotx);
        var cy = Math.cos(roty);
        var sy = Math.sin(roty);
        var cz = Math.cos(rotz);
        var sz = Math.sin(rotz);
        return svg3d.setRotationMatrix(cx, sx, cy, sy, cz, sz);
    }

    svg3d.setRotationMatrix = function(cx, sx, cy, sy, cz, sz) {
        return [
			cz * cy, 	sz * cx * cy - sx * sy, 	- sz * sx * cy - cx * sy, 	0,
			-sz, 		cz * cx,					- cz * sx, 					0,
			cz * sy, 	sz * cx * sy + sx * cy,		cx * cy - sz * sx * sy, 	0
		];
    }

    svg3d.setTranslationMatrix = function(x, y, z) {
		return [
			1, 0, 0, x,
            0, 1, 0, y,
            0, 0, 1, z
        ];
    }
	
	svg3d.setScaleMatrix = function(x, y, z) {
        return [
			x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0
        ];
    }

    svg3d.sortFacesAverageZ = function(pathArray) {
        var indexArray = [];
        var i = pathArray.length;
        while (i--) {
            var current = pathArray[i];
            var j = indexArray.length;
            while (j && pathArray[indexArray[j - 1]].z > current.z) {
                //translates to the right
                indexArray[j] = indexArray[j - 1];
                j--;
            }
            //only dumps the index of the path
            indexArray[j] = i;
        }
        return indexArray;
    }

    svg3d.sortFacesOneToAll = function(pathArray) {
        var indexArray = [];
        //optimization
        var i = pathArray.length;
        while (i--) {
            var current = pathArray[i];
            var j = indexArray.length;
            //compares current to each path, if it is in front puts it at the beginning of the list
            while (j && isBehind(pathArray[indexArray[j - 1]], current)) {
                //translates the index to the right
                indexArray[j] = indexArray[j - 1];
                j--;
            }
            //only dumps the indice of the path
            indexArray[j] = i;
        }
        return indexArray;
    }

    svg3d.sortFacesAllToAll = function(pathArray) {
        var indexArray = [];
        var i = pathArray.length;
        while (i--) {
            var current = pathArray[i];
            var j = indexArray.length;
            //continue browsing if compared is behind current
            var continueBrowsing = true;
            //compares current to each path, if it is in front puts it at the beginning of the list
            while (j && continueBrowsing) {
                var compared = pathArray[indexArray[j - 1]];
                //it is possible that both are true or false
                var comparedIsBehindCurrent = isBehind(compared, current);
                var currentIsBehindCompared = isBehind(current, compared);
                //by default compared is behind in order to continue comparison on the rest of the list
                continueBrowsing = (comparedIsBehindCurrent === currentIsBehindCompared) || comparedIsBehindCurrent;
                if (continueBrowsing) {
                    //translates the index to the right
                    indexArray[j] = indexArray[j - 1];
                    j--;
                }
            }
            //only dumps the indice of the path
            indexArray[j] = i;
        }
        return indexArray;
    }

    /*
With :
- A is the position of the camera
- B is the position of the face
- P is the position of the reference face
- u is the normal of the reference
if AP . u and BP . u have opposite signs, then they are not on the same side of the plan, then face is behind reference

A is ( svg3d.xOrigin, svg3d.yOrigin, - svg3d.zRatio * svg3d.focalDistance )
which is projected at (svg3d.xInfinite, svg3d.yInfinite)

facePosRefPos_RefNormal means 'are facePosRefPos and RefNormal in the same direction ?'

*/
    function isBehind(face, reference) {
        var refNormal = reference.normal;
        var refPos = reference.position;
        var facePos = face.position;
        var camPos = [svg3d.xOrigin, svg3d.yOrigin, - svg3d.zRatio * svg3d.focalDistance];
        var camPosRefPos = [refPos[0] - camPos[0], refPos[1] - camPos[1], refPos[2] - camPos[2]];
        var facePosRefPos = [refPos[0] - facePos[0], refPos[1] - facePos[1], refPos[2] - facePos[2]];
        var camPosRefPos_RefNormal = camPosRefPos[0] * refNormal[0] + camPosRefPos[1] * refNormal[1] + camPosRefPos[2] * refNormal[2];
        var facePosRefPos_RefNormal = facePosRefPos[0] * refNormal[0] + facePosRefPos[1] * refNormal[1] + facePosRefPos[2] * refNormal[2];
        if (facePosRefPos_RefNormal < 0 && camPosRefPos_RefNormal > 0) {
            return true;
        }
        if (facePosRefPos_RefNormal > 0 && camPosRefPos_RefNormal < 0) {
            return true;
        }
        return false;
    }

    /*
Expose Objects
*/

    svg3d.Shape = Shape;
    svg3d.Path = Path;
    svg3d.Path3d = Path3d;
    svg3d.Rect = Rect;
    svg3d.Polyline = Polyline;
    svg3d.Polyline3d = Polyline3d;
    svg3d.Circle = Circle;
    svg3d.Circle3d = Circle3d;
    svg3d.Use = Use;
    //svg3d.Use3d = Use3d;

    window.svg3d = svg3d;

})(window);
