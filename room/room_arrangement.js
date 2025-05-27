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
        render();
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
        for (let item of furniture) {
            let mv = mult(lookAt(eye, at, up), translate(item.pos[0], item.pos[1], item.pos[2]));
            gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelViewMatrix"), false, flatten(mv));
            gl.uniform4fv(gl.getUniformLocation(program, "uColor"), vec4(0.3, 0.6, 0.8, 1.0)); // any cube color

            drawCube(item.size);
        }
        createWalls();

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
    
        // Define four wall planes: back, right, front, left
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
        if(!isFloorView){
            console.log("Click ignored, not in floor view");
            return;
        }
        console.log("Tile clicked");
        let rect = canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        let xWorld = (x / rect.width) * roomSize - roomSize / 2;
        let zWorld = (y / rect.height) * roomSize - roomSize / 2;

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

    function placeCube(size){
        if (!selectedTile || !inselectmenu) {
            console.log("No tile selected or menu not active.");
            return;
        }
        console.log("Placing cube of size:", size, "at tile position:", selectedTile.pos);
        let cubePos = vec3(selectedTile.pos[0], size / 2, selectedTile.pos[2]);
        furniture.push({
            pos: cubePos,
            size: size,
        })
        console.log("Cube placed at position:", cubePos);

        selectedTile.selected = false;
        selectedTile = null;
        inselectmenu = false;
        let menu = document.getElementById("cube-menu");
        menu.style.display = "none";
    }

    function drawCube(size) {
        console.log("Drawing cube with size:", size);
        let half = size / 2;
        let vertices = [
            vec4(-half, -half, -half, 1),
            vec4(-half, -half, half, 1),
            vec4(half, -half, half, 1),
            vec4(half, -half, -half, 1),
            vec4(-half, half, -half, 1),
            vec4(-half, half, half, 1),
            vec4(half, half, half, 1),
            vec4(half, half, -half, 1)
        ]
        let indices = [
            0, 1, 2, 0, 2, 3, // bottom
            4, 5, 6, 4, 6, 7, // top
            0, 1, 5, 0, 5, 4, // left
            2, 3, 7, 2, 7, 6, // right
            1, 2, 6, 1, 6, 5, // front
            0, 3, 7, 0, 7, 4 // back
        ];
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
        gl.uniform4fv(gl.getUniformLocation(program, "uColor"), vec4(0.3, 0.6, 0.8, 1.0)); // any cube color
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }
}

room();