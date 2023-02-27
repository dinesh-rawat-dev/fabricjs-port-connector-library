import { fabric } from "fabric";
import "./styles.css";

const el = document.getElementById("canvas");
const canvas = (window.canvas = new fabric.Canvas(el));

canvas.setDimensions({
  width: 1000,
  height: 1000
});

const points = [
    { x: -50, y: 150 },
    { x: 100, y: 150 },
    { x: 50, y: 50 },
    { x: -100, y: 50 }
  ],
  polygon = new fabric.Polygon(points, {
    // top: 20,
    angle: 0
  });

var group = new fabric.Group([], {
  subTargetCheck: true
});
canvas.add(group);
canvas.centerObjectH(polygon);
//@ts-ignore
polygon.id = Date.now();
group.addWithUpdate(polygon);

//@ts-ignore
group.id = Date.now();
const boundingProps = group.getCenterPoint();

const textbox = new fabric.Textbox(`${group.id}`, {
  width: 150,
  fontSize: 20,
  textAlign: "center",
  left: boundingProps.x,
  top: boundingProps.y,
  fill: "#fff",
  originX: "center",
  originY: "center",
  selectable: true,
  evented: true,
  editable: true,
  splitByGrapheme: true,
  lockScalingX: true,
  lockScalingY: true
});

textbox.width = group.getScaledWidth() * 0.75;
group.addWithUpdate(textbox);

textbox.on("mousedown", () => {
  textbox.enterEditing();
  textbox.hiddenTextarea.focus();
});

group.on("deselected", () => {
  textbox.exitEditing();
});

function getPolyVertices(poly) {
  const points = poly.points,
    vertices = [];
  if (!points) {
    return true;
  }
  for (let i = 0; i < points.length; i++) {
    const point = points[i],
      nextPoint = points[(i + 1) % points.length],
      midPoint = {
        x: (point.x + nextPoint.x) / 2,
        y: (point.y + nextPoint.y) / 2
      };
    const x = midPoint.x - poly.pathOffset.x,
      y = midPoint.y - poly.pathOffset.y;
    vertices.push(
      fabric.util.transformPoint(
        { x: x, y: y },
        fabric.util.multiplyTransformMatrices(
          poly.canvas.viewportTransform,
          poly.calcTransformMatrix()
        )
      )
    );
  }
  return vertices;
}

function addCustomPropertyToFabric(object, props) {
  object.toObject = ((toObject) => {
    return function () {
      return fabric.util.object.extend(toObject.call(this), props);
    };
  })(object.toObject);
}

function addPortsToPolygon(polygon) {
  const polyVertices = getPolyVertices(polygon);
  const circles = [];

  polyVertices.forEach((vertice) => {
    const circ = new fabric.Circle({
      radius: 5,
      originX: "center",
      originY: "center",
      fill: "transparent",
      left: vertice.x,
      top: vertice.y,
      //@ts-ignore
      className: "control_flow_points"
    });
    addCustomPropertyToFabric(circ, {
      className: "control_flow_points"
    });
    circles.push(circ);
    canvas.add(circ);
  });

  function updateCirclesPosition() {
    const newVertices = getPolyVertices(polygon);
    newVertices.forEach((vertice, idx) => {
      const circ = circles[idx];
      circ.left = vertice.x;
      circ.top = vertice.y;
    });
  }

  group.on("scaling", updateCirclesPosition);
  group.on("skewing", updateCirclesPosition);
  group.on("rotating", updateCirclesPosition);
  group.on("moving", updateCirclesPosition);
}

addPortsToPolygon(polygon);

const CONTROL_FLOW_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='8px' viewBox='0 0 24 24' width='8px' fill='%23573DF4'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Cpath d='M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z'/%3E%3C/svg%3E";
const TOLERANCE_VALUE = 20;

function renderIcon(icon) {
  return function renderIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
}

function currentCornerMetrix() {
  return {
    rightControlFlowControl: "mr",
    leftControlFlowControl: "ml",
    topControlFlowControl: "mt",
    bottomControlFlowControl: "mb"
  };
}

/**
 * Opposite
 */
function oppositeCornerMetrix() {
  return {
    rightControlFlowControl: "ml",
    leftControlFlowControl: "mr",
    topControlFlowControl: "mb",
    bottomControlFlowControl: "mt"
  };
}

function drawLine(
  canvas,
  fromPoint,
  toPoint,
  mainShape,
  clonedShape,
  direction
) {
  const line: any = new fabric.Line([...fromPoint, ...toPoint], {
    stroke: "black",
    strokeWidth: 2,
    centeredRotation: true,
    centeredScaling: true
  });

  line.id = Date.now();
  canvas.add(line);
  line.sendToBack();

  mainShape.children = mainShape.children || [];
  mainShape.children.push({
    connector: line.id,
    id: clonedShape.id
  });
  const mainShapeProp = {
    children: mainShape.children
  };

  addCustomPropertyToFabric(mainShape, mainShapeProp);
  clonedShape.parent = clonedShape.parent || [];
  clonedShape.parent.push({
    connector: line.id,
    id: mainShape.id
  });
  const cloneShapeProp = {
    parent: clonedShape.parent
  };
  addCustomPropertyToFabric(clonedShape, cloneShapeProp);

  // Port 1
  const port1MiddleCornerName = currentCornerMetrix[direction];

  // Port 2
  const port2MiddleCornerName = oppositeCornerMetrix[direction];

  line.bounds = line.bounds || {};

  const lineProp = {
    bounds: {
      [port1MiddleCornerName]: [
        (line.bounds[port1MiddleCornerName] || []).push(clonedShape.id)
      ],
      [port2MiddleCornerName]: [
        (line.bounds[port2MiddleCornerName] || []).push(mainShape.id)
      ]
    }
  };

  line.set(lineProp);
  addCustomPropertyToFabric(line, {
    lineProp
  });

  canvas.requestRenderAll();
}

function getDistance(point1, point2) {
  const xDiff = point2[0] - point1[0];
  const yDiff = point2[1] - point1[1];
  return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

function getClosestPoint(point, points) {
  let closestPoint = null;
  let closestDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const distance = getDistance(point, points[i]);
    if (distance < closestDistance) {
      closestPoint = points[i];
      closestDistance = distance;
    }
  }

  return closestPoint;
}

function addConnector(canvas, object, direction, cloned, sourcePoint) {
  const ports2 = canvas
    .getObjects()
    .filter(
      (object) =>
        object &&
        object.isType("circle") &&
        object.className === "control_flow_points"
    )
    .map((object) => [object.left, object.top]);

  //@ts-ignore
  let currentShapeCoords = ports2.slice();

  // Port 2
  let targetPoint: any = getClosestPoint(sourcePoint, currentShapeCoords);
  drawLine(canvas, sourcePoint, targetPoint, object, cloned, direction);
}

function createClonedObjectAndAddConnector(object: any, prop, controlClicked) {
  const direction = object.__corner;
  const ports1 = canvas
    .getObjects()
    .filter(
      (object) =>
        object &&
        object.isType("circle") &&
        //@ts-ignore
        object.className === "control_flow_points"
    )
    .map((object) => [object.left, object.top]);

  //@ts-ignore
  let currentShapeCoords = ports1.slice();
  const sourcePoint: any = getClosestPoint(
    [controlClicked.x, controlClicked.y],
    currentShapeCoords
  );
  // object.parent = [];
  // object.children = [];

  object.clone((cloned: any) => {
    cloned.set(prop);
    cloned.id = Date.now();
    cloned.parent = [];
    cloned.children = [];
    const textbox = cloned.item(1);
    textbox.text = `${cloned.id}`;
    canvas.add(cloned);
    canvas.discardActiveObject();
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    addFlowPoints(cloned);
    addPortsToPolygon(cloned.item(0));
    setTimeout((_) => {
      addConnector(canvas, object, direction, cloned, sourcePoint);
    });
  });
}

function removeControlFlowPoints() {
  canvas.forEachObject(
    (object) =>
      object &&
      object &&
      object.isType("circle") &&
      //@ts-ignore
      object.className === "control_flow_points" &&
      canvas.remove(object) &&
      canvas.requestRenderAll()
  );
}

function createTopControlFlowObject(e) {
  const object = canvas.getActiveObject();

  const pointer: any = canvas.getPointer(e);
  const origY = pointer.y;

  const prop = {
    top: origY - object.height - 2 * TOLERANCE_VALUE
  };

  createClonedObjectAndAddConnector(object, prop, pointer);
}

function createRightControlFlowObject(e) {
  const object = canvas.getActiveObject();
  const pointer: any = canvas.getPointer(e);
  const origX = pointer.x;
  const prop = {
    left: origX + 2 * TOLERANCE_VALUE
  };

  createClonedObjectAndAddConnector(object, prop, pointer);
}

function createLeftControlFlowObject(e, target) {
  const object = canvas.getActiveObject();
  const pointer: any = canvas.getPointer(e);
  const origX = pointer.x;
  const prop = {
    left: origX - object.width - 2 * TOLERANCE_VALUE
  };

  createClonedObjectAndAddConnector(object, prop, pointer);
}

function createBottomControlFlowObject(e) {
  const object = canvas.getActiveObject();
  const pointer: any = canvas.getPointer(e);
  const origY = pointer.y;
  const prop = {
    top: origY + 2 * TOLERANCE_VALUE
  };

  createClonedObjectAndAddConnector(object, prop, pointer);
}

function addFlowPoints(object: any): any {
  const controlFlowIcon = CONTROL_FLOW_ICON;
  const controlFlowImg = document.createElement("img");
  controlFlowImg.src = controlFlowIcon;

  const bottomFlowControl = {
    key: "bottom",
    x: object.controls.mb.x,
    y: object.controls.mb.y,
    offsetY: 1.5 * TOLERANCE_VALUE,
    mouseUpHandler: createBottomControlFlowObject
  };

  const topFlowControl = {
    key: "top",
    x: object.controls.mt.x,
    y: object.controls.mt.y,
    offsetY: -1.5 * TOLERANCE_VALUE,
    mouseUpHandler: createTopControlFlowObject
  };

  const leftFlowControl = {
    key: "left",
    x: object.controls.ml.x,
    y: object.controls.ml.y,
    offsetX: -1.5 * TOLERANCE_VALUE,
    mouseUpHandler: createLeftControlFlowObject
  };

  const rightFlowControl = {
    key: "right",
    x: object.controls.mr.x,
    y: object.controls.mr.y,
    offsetX: 1.5 * TOLERANCE_VALUE,
    mouseUpHandler: createRightControlFlowObject
  };

  [
    bottomFlowControl,
    topFlowControl,
    leftFlowControl,
    rightFlowControl
  ].forEach(
    (contol) =>
      (fabric.Object.prototype.controls[
        `${[contol.key]}ControlFlowControl`
      ] = new fabric.Control({
        cursorStyle: "crosshair",

        //@ts-ignore
        render: renderIcon(controlFlowImg),
        //@ts-ignore
        cornerSize: 8,
        ...contol
      }))
  );
  if (object && object.item && object.item(0)) {
    addPortsToPolygon(object.item(0));
  }
  canvas.requestRenderAll();
}

function objectChangingPosition(options: any): any {
  const object = canvas.getActiveObject();
  if (!object) {
    return true;
  }

  removeControlFlowPoints();
  addFlowPoints(object);
}

[
  "object:modified",
  "object:moving",
  "object:scaling",
  "mouse:down",
  "selection:created",
  "selection:entered"
].forEach((event) => canvas.on(event, objectChangingPosition));

function findObjectById(id) {
  return canvas.getObjects().find((object) => object.id === id);
}

function adjustAssociatedNodes(nodes, coord1, coord2) {
  nodes.forEach((node) => {
    const line = findObjectById(node.connector);
    if (line) {
      const allControlPoints = canvas
        .getObjects()
        .filter(
          (object) =>
            object &&
            object.isType("circle") &&
            //@ts-ignore
            object.className === "control_flow_points"
        )
        .map((object) => [object.left, object.top]);

      //@ts-ignore
      const currentShapeCoords = allControlPoints.slice();

      const targetPoint: any = getClosestPoint(
        [line[coord1], line[coord2]],
        currentShapeCoords
      );
      line.set({
        [coord1]: targetPoint[0],
        [coord2]: targetPoint[1]
      });
    }
  });
}

canvas.on("object:moving", (e: any) => {
  const object = e.target;
  if (object.children && object.children.length) {
    adjustAssociatedNodes(object.children, "x1", "y1");
  }
  if (object.parent && object.parent.length) {
    adjustAssociatedNodes(object.parent, "x2", "y2");
    console.log(object.parent.length);
  }
});
