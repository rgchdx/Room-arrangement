"use strict";

var room = function() {
    let canvas, gl, program;

    // camera position and view
    let eye = vec3(0.0, 1.0, 5.0);
    let at = vec3(0.0, 1.0, 0.0);
    let up = vec3(0.0, 1.0, 0.0);

    // matrices
    let fov = 60;
    let near = 0.1;
    let far = 100;

    // initial colors
    let wallColor = vec4(0.8, 0.8, 0.8, 1.0);
    let floorColor = vec4(0.5, 0.5, 0.5, 1.0);

    // initial room size
    let roomSize = 20;
    let tileCount = 20;
    let tileSize = roomSize / tileCount;
    let tiles = [];

    window.onload() = function init() {
        // Getting canvas elements
        canvas = document.getElementById("gl-canvas");
        gl = canvas.getContext("webgl2");
        if (!gl) alert("WebGL 2.0 isn't available");

        // Set viewport
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        // initialize shaders
        program = initShaders(gl, "vertex-shader", "fragment-shader");
        gl.useProgram(program);

        setTiles();

        window.addEventListener("keydown", keypressed);
        window.addEventListener("mousemove", mouseMoved);

        render();
    }

    function setTiles() {
        for (let i = 0; i < tileCount; i++) {
            for (let j = 0; j < tileCount; j++) {
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

        let aPosition = gl.getAttribLocation(program, "aPosition");
        gl.vertexAttribPointer(aPosition, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosition);

        let iBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
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

        let tileX = Math.floor((x / canvas.width) * tileCount);
        let tileY = Math.floor((y / canvas.height) * tileCount);

        for (let i = 0; i < tiles.length; i++) {
            tiles[i].selected = (i === tileX + tileY * tileCount);
        }
    }
}

room();