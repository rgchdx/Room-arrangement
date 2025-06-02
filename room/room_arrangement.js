"use strict";

var room = function() {
    let canvas, gl, program;

    // camera position and view
    let eye = vec3(0.0, 17.0, 0.0);
    let at = vec3(0.0, 0.0, 0.0);
    let up = vec3(0.0, 0.0, -1.0);

    // alternate position to look at room when objects placed
    let currentEye = vec3(0.0, 1.0, 10.0);
    let currentAt = vec3(0.0, 0.0, 1.0);
    let currentUp = vec3(0.0, 0.0, -1.0);

    let isFloorView = true;

    // matrices
    let fov = 60;
    let near = 0.1;
    let far = 100;

    // initial colors
    let wallColor = vec4(0.8, 0.8, 0.8, 1.0);
    let floorColor = vec4(0.5, 0.5, 0.5, 1.0);

    // initial room size
    let roomSize = 20;
    let tileCount = 15;
    let tileSize = roomSize / tileCount;
    let tiles = [];

    let selectedTile = null;
    let inselectmenu = false;

    let furniture = [];

    window.onload = function init() {
        // Getting canvas elements
        canvas = document.getElementById("gl-canvas");
        gl = canvas.getContext("webgl2");
        if (!gl) alert("WebGL 2.0 isn't available");

        // Set viewport
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // initialize shaders
        program = initShaders(gl, "vertex-shader", "fragment-shader");
        gl.useProgram(program);

        setTiles();


        window.addEventListener("keydown", keypressed);
        window.addEventListener("mousemove", mouseMoved);
        window.addEventListener("keydown", (event) => {
            if (event.key === "v") {
                toggleView();
            }
        });
        canvas.addEventListener("click", onClickTile);
        window.placeCube = placeCube;

        window.changeFurnitureColor = function() {
            console.log("Changing color of selected furniture");
            let selected = furniture.find(f => f.selected);
            console.log("Selected furniture:", selected);
            if (selected) {
                selected.color = vec4(Math.random(), Math.random(), Math.random(), 1.0);
            }
        };
        
        window.deleteSelectedFurniture = function() {
            furniture = furniture.filter(f => !f.selected);
            hideFurnitureMenu();
        };

        render();
    }

    function toggleView() {
        if (isFloorView) {
            eye = vec3(0.0, 17.0, 0.0);
            at = vec3(0.0, 0.0, 0.0);
            up = vec3(0.0, 0.0, -1.0);
        } else {
            eye = currentEye;
            at = currentAt;
            up = currentUp;
        }
        isFloorView = !isFloorView;
        selectedTile = null;
        inselectmenu = false;
        for (let tile of tiles) {
            tile.selected = false;
        }
    }

    function setTiles() {
        for (let i = 0; i < tileCount; i++) {
            for (let j = 0; j < tileCount; j++) {
                // -roomSize / 2 centers the grid in the room by starting the first timle at the leftmost x and backmost z
                let x = -roomSize / 2 + i * tileSize + tileSize / 2;
                let z = -roomSize / 2 + j * tileSize + tileSize / 2;
                tiles.push({
                    pos: vec3(x, 0, z),
                    selected: false,
                })
            }
        }
    }

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        let projectionMatrix = perspective(fov, canvas.width / canvas.height, near, far);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjectionMatrix"), false, flatten(projectionMatrix));

        let viewMatrix = lookAt(eye, at, up);
        for (let tile of tiles) {
            let mv = mult(viewMatrix, translate(tile.pos[0], tile.pos[1], tile.pos[2]));
            let color = tile.selected ? vec4(0.9, 0.5, 0.2, 1) : floorColor;

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelViewMatrix"), false, flatten(mv));
            gl.uniform4fv(gl.getUniformLocation(program, "uColor"), color);

            drawQuad(tileSize);
        }
        createWalls();
        for (let item of furniture) {
            let mv = mult(lookAt(eye, at, up), translate(item.pos[0], item.pos[1], item.pos[2]));
            gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelViewMatrix"), false, flatten(mv));
        
            let color = item.selected ? item.color : vec4(1.0, 0.0, 0.0, 1.0)
            console.log(item.selected ? "Selected furniture color:" : "Furniture color:", color);
            gl.uniform4fv(gl.getUniformLocation(program, "uColor"), color);
        
            drawFurniture(item);
        }

        requestAnimationFrame(render);
    }

    function drawQuad(size) {
        let half = size / 2;
        let vertices = [
            vec4(-half, 0, -half, 1),
            vec4(-half, 0, half, 1),
            vec4(half, 0, half, 1),
            vec4(half, 0, -half, 1),
        ];

        let indices = [0, 1, 2, 0, 2, 3];

        let vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

        let vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length);

        let aPosition = gl.getAttribLocation(program, "aPosition");
        gl.vertexAttribPointer(aPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosition);

        let iBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }

    function createWalls() {
        let wallHeight = 10;
            const walls = [
            [
                vec4(-roomSize + 0.5, 0, -roomSize + 0.7, 1.0),
                vec4(roomSize/4 - 3.9, 0, -roomSize + 1, 1.0),
                vec4(roomSize/4 - 3.9, wallHeight, -roomSize + 1, 1.0),
                vec4(-roomSize + 0.5, wallHeight, -roomSize + 0.7, 1.0),
            ],
            [
                vec4(roomSize/4 - 4.4, 0, -roomSize + 1, 1.0), // top 
                vec4(roomSize/4 - 4.4, 0, roomSize/4 + 1, 1.0),
                vec4(roomSize/4 - 4.4, wallHeight, roomSize/4 + 1, 1.0),
                vec4(roomSize/4 - 4.4, wallHeight, -roomSize + 1, 1.0), // top
            ],
            [
                vec4(-roomSize + 0.7, 0, roomSize / 2, 1.0),
                vec4(-roomSize + 0.7, 0, -roomSize + 0.7, 1.0),
                vec4(-roomSize + 0.7, wallHeight, -roomSize + 0.7, 1.0),
                vec4(-roomSize + 0.7, wallHeight, roomSize / 2, 1.0),
            ]
        ];
    
        const indices = [0, 1, 2, 0, 2, 3];
    
        for (let wall of walls) {
            let vBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, flatten(wall), gl.STATIC_DRAW);
    
            let vPosition = gl.getAttribLocation(program, "vPosition");
            gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(vPosition);
    
            let aPosition = gl.getAttribLocation(program, "aPosition");
            gl.vertexAttribPointer(aPosition, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(aPosition);
    
            let iBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
            gl.uniform4fv(gl.getUniformLocation(program, "uColor"), wallColor);
    
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }
    }

    function keypressed(event) {
        const speed = 0.3;
        switch (event.key) {
            case 'w': eye[2] -= speed; at[2] -= speed; break;
            case 's': eye[2] += speed; at[2] += speed; break;
            case 'a': eye[0] -= speed; at[0] -= speed; break;
            case 'd': eye[0] += speed; at[0] += speed; break;
            case 'f': floorColor = vec4(Math.random(), Math.random(), Math.random(), 1); break;
            case 'c': wallColor = vec4(Math.random(), Math.random(), Math.random(), 1); break;
        }
    }

    function mouseMoved(event) {
        let rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;

        let xWorld = (x / rect.width) * roomSize - roomSize / 2;
        let zWorld = (y / rect.height) * roomSize - roomSize / 2;
        if (!inselectmenu) {
            for (let tile of tiles) {
                let dx = Math.abs(xWorld - tile.pos[0]);
                let dz = Math.abs(zWorld - tile.pos[2]);
                tile.selected = dx < tileSize / 2 && dz < tileSize / 2;
            }
        }
        console.log(`Mouse moved to: (${xWorld.toFixed(2)}, ${zWorld.toFixed(2)})`);
    }

    function onClickTile(event) {
        console.log("Tile clicked");
        let rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        let xWorld = (x / rect.width) * roomSize - roomSize / 2;
        let zWorld = (y / rect.height) * roomSize - roomSize / 2;

        for (let item of furniture) {
            let dx = Math.abs(xWorld - item.pos[0]);
            let dz = Math.abs(zWorld - item.pos[2]);
            let size = item.size;
            if (dx < size / 2 && dz < size / 2) {
                deselectAllFurniture();
                item.selected = true;
                showFurnitureMenu(event.pageX, event.pageY);
                return;
            }
        }
        deselectAllFurniture();

        for (let tile of tiles) {
            let dx = Math.abs(xWorld - tile.pos[0]);
            let dz = Math.abs(zWorld - tile.pos[2]);
            if (dx < tileSize / 2 && dz < tileSize / 2) {
                console.log("Tile clicked at position:", tile.pos);
                showCubeSizeMenu(tile,event);
                console.log("Tile selected:", tile);
                break;
            }
        }
    }

    function showCubeSizeMenu(tile,event) {
        selectedTile = tile;
        inselectmenu = true;
        console.log("Showing cube size menu for tile at position:", tile.pos);
        let menu = document.getElementById("cube-menu");
        menu.style.left = event.pageX + "px";
        menu.style.top = event.pageY + "px";
        menu.style.display = "block";
    }

    

    function placeCube(type){
        if (!selectedTile || !inselectmenu) {
            console.log("No tile selected or menu not active.");
            return;
        }
    
        let size;
        switch (type) {
            case 'chair':
                size = 1;
                break;
            case 'table':
                size = 1.5;
                break;
            case 'sofa':
                size = 2;
                break;
            default:
                console.warn("Unknown furniture type:", type);
                return;
        }
    
        let yPos = 0.0;
        let cubePos = vec3(selectedTile.pos[0], yPos, selectedTile.pos[2]);
        furniture.push({
            type: type,
            pos: cubePos,
            size: size,
            selected: false,
            rotation: 0,
            color: vec4(0.3, 0.6, 0.8, 1.0)
        });
    
        selectedTile.selected = false;
        selectedTile = null;
        inselectmenu = false;
    
        let menu = document.getElementById("cube-menu");
        menu.style.display = "none";
    }

    function drawFurniture(item) {
        let { type, size } = item;
        let half = size / 2;
    
        let vertices, indices;
    
        if (type === 'chair') {
            vertices = [
                // seat
                vec4(-0.5, 0.0, -0.5, 1), vec4(-0.5, 0.0, 0.5, 1), vec4(0.5, 0.0, 0.5, 1), vec4(0.5, 0.0, -0.5, 1),
                vec4(-0.5, 0.5, -0.5, 1), vec4(-0.5, 1.0, 0.5, 1), vec4(0.5, 1.0, 0.5, 1), vec4(0.5, 1.0, -0.5, 1),
    
                // backrest
                vec4(-0.5, 0.5, -0.5, 1), vec4(-0.5, 2.0, -0.5, 1), vec4(0.5, 2.0, -0.5, 1), vec4(0.5, 1.0, -0.5, 1)
            ];
    
            indices = [
                0, 1, 2, 0, 2, 3,  // bottom
                4, 5, 6, 4, 6, 7,  // top
                0, 1, 5, 0, 5, 4,  // left
                2, 3, 7, 2, 7, 6,  // right
                1, 2, 6, 1, 6, 5,  // front
                0, 3, 7, 0, 7, 4,  // back
                8, 9,10, 8,10,11   // backrest front
            ];
    
        } else if (type === 'table') { // I got help from copilot for this portion.
            let topHeight = 0.1;
            let topY = 1.0;
        
            let legWidth = 0.1;
            let legHeight = topY;
            // Table top
            vertices = [
                vec4(-1.0, topY, -0.6, 1), vec4(-1.0, topY, 0.6, 1), vec4(1.0, topY, 0.6, 1), vec4(1.0, topY, -0.6, 1),
                vec4(-1.0, topY + topHeight, -0.6, 1), vec4(-1.0, topY + topHeight, 0.6, 1), vec4(1.0, topY + topHeight, 0.6, 1), vec4(1.0, topY + topHeight, -0.6, 1)
            ];

            let legVertices = [
                // Front-left leg
                vec4(-1.0, 0, -0.6, 1), vec4(-1.0, topY, -0.6, 1), vec4(-1.0 + legWidth, topY, -0.6, 1), vec4(-1.0 + legWidth, 0, -0.6, 1),
                // Front-right leg
                vec4(1.0 - legWidth, 0, -0.6, 1), vec4(1.0 - legWidth, topY, -0.6, 1), vec4(1.0, topY, -0.6, 1), vec4(1.0, 0, -0.6, 1),
                // Back-left leg
                vec4(-1.0, 0, 0.6, 1), vec4(-1.0, topY, 0.6, 1), vec4(-1.0 + legWidth, topY, 0.6, 1), vec4(-1.0 + legWidth, 0, 0.6, 1),
                // Back-right leg
                vec4(1.0 - legWidth, 0, 0.6, 1), vec4(1.0 - legWidth, topY, 0.6, 1), vec4(1.0, topY, 0.6, 1), vec4(1.0, 0, 0.6, 1)
            ];
        
            vertices = vertices.concat(legVertices);
        
            indices = [
                // Table top
                4, 5, 6, 4, 6, 7,
                0, 1, 5, 0, 5, 4,
                1, 2, 6, 1, 6, 5,
                2, 3, 7, 2, 7, 6,
                3, 0, 4, 3, 4, 7,
                0, 1, 2, 0, 2, 3,
                // Front-left leg
                8, 9, 10, 8, 10, 11,
                // Front-right leg
                12, 13, 14, 12, 14, 15,
                // Back-left leg
                16, 17, 18, 16, 18, 19,
                // Back-right leg
                20, 21, 22, 20, 22, 23
            ];
        
            // Legs (4 total, 1 at each corner)
            let legPositions = [
                [-0.9, 0, -0.5],
                [-0.9, 0,  0.5],
                [ 0.9, 0, -0.5],
                [ 0.9, 0,  0.5],
            ];
        
            for (let i = 0; i < legPositions.length; i++) {
                let [x, y, z] = legPositions[i];
        
                let baseIndex = vertices.length;
        
                vertices.push(
                    vec4(x, y, z, 1),
                    vec4(x + legWidth, y, z, 1),
                    vec4(x + legWidth, y, z + legWidth, 1),
                    vec4(x, y, z + legWidth, 1),
        
                    vec4(x, y + legHeight, z, 1),
                    vec4(x + legWidth, y + legHeight, z, 1),
                    vec4(x + legWidth, y + legHeight, z + legWidth, 1),
                    vec4(x, y + legHeight, z + legWidth, 1)
                );
        
                // Add indices for this leg (6 faces)
                indices.push(
                    baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3, // bottom
                    baseIndex + 4, baseIndex + 5, baseIndex + 6, baseIndex + 4, baseIndex + 6, baseIndex + 7, // top
                    baseIndex, baseIndex + 1, baseIndex + 5, baseIndex, baseIndex + 5, baseIndex + 4, // side 1
                    baseIndex + 1, baseIndex + 2, baseIndex + 6, baseIndex + 1, baseIndex + 6, baseIndex + 5, // side 2
                    baseIndex + 2, baseIndex + 3, baseIndex + 7, baseIndex + 2, baseIndex + 7, baseIndex + 6, // side 3
                    baseIndex + 3, baseIndex + 0, baseIndex + 4, baseIndex + 3, baseIndex + 4, baseIndex + 7  // side 4
                );
            }
        } else if (type === 'sofa') {
            vertices = [
                // base
                vec4(-1.5, 0.0, -0.5, 1), vec4(-1.5, 0.0, 0.5, 1), vec4(1.5, 0.0, 0.5, 1), vec4(1.5, 0.0, -0.5, 1),
                vec4(-1.5, 1.0, -0.5, 1), vec4(-1.5, 1.0, 0.5, 1), vec4(1.5, 1.0, 0.5, 1), vec4(1.5, 1.0, -0.5, 1),
    
                // backrest
                vec4(-1.5, 1.0, -0.5, 1), vec4(-1.5, 1.5, -0.5, 1), vec4(1.5, 1.5, -0.5, 1), vec4(1.5, 1.0, -0.5, 1)
            ];
    
            indices = [
                0,1,2,0,2,3,
                4,5,6,4,6,7,
                1,2,6,1,6,5,
                0,3,7,0,7,4,
                8,9,10,8,10,11 // backrest
            ];
        }
    
        let vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    
        let vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);
    
        let aPosition = gl.getAttribLocation(program, "aPosition");
        gl.vertexAttribPointer(aPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosition);
    
        let iBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
        gl.uniform4fv(gl.getUniformLocation(program, "uColor"), vec4(0.3, 0.6, 0.8, 1.0));
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }

    function deselectAllFurniture() {
        for (let item of furniture) item.selected = false;
        hideFurnitureMenu();
    }

    function showFurnitureMenu(x, y) {
        let menu = document.getElementById("furniture-menu");
        inselectmenu = true;
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.style.display = "block";
    }
    
    function hideFurnitureMenu() {
        let menu = document.getElementById("furniture-menu");
        inselectmenu = false;
        if (menu) menu.style.display = "none";
    }


}

room();