(function() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const section = canvas.parentElement;

    // Create the hidden map canvas.
    const mapCanvas = document.createElement('canvas');
    const mapCtx = mapCanvas.getContext('2d');

    let width, height;
    const DOT_SPACING = 10;
    const MAX_DOT_SIZE = 4.5;
    const MIN_DOT_SIZE = 0.8;

    // Pre-rendered map dimensions.
    const MAP_WIDTH = 1800;
    const MAP_HEIGHT = 900;

    let earthOffset = 0;
    const SCROLL_SPEED = 30;

    const BG_COLOR = '#0a0a12';
    const DOT_COLOR = { r: 120, g: 100, b: 200 };

    // Pre-rendered map data.
    let mapImageData = null;

    // Load and pre-render GeoJSON to a bitmap.
    async function loadAndRenderGeoJSON() {
        try {
            const response = await fetch('/custom.geo.json');
            const data = await response.json();

            mapCanvas.width = MAP_WIDTH;
            mapCanvas.height = MAP_HEIGHT;

            mapCtx.fillStyle = '#000000';
            mapCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

            mapCtx.fillStyle = '#FFFFFF';

            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (geometry.type === 'Polygon') {
                    drawPolygon(geometry.coordinates[0]);
                } else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(polygon => {
                        drawPolygon(polygon[0]);
                    });
                }
            });

            mapImageData = mapCtx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT);

            resize();
            requestAnimationFrame(animate);
        } catch (error) {
            console.error('Failed to load GeoJSON:', error);
        }
    }

    function drawPolygon(coords) {
        mapCtx.beginPath();
        coords.forEach((coord, i) => {
            const x = ((coord[0] + 180) / 360) * MAP_WIDTH;
            const y = ((90 - coord[1]) / 180) * MAP_HEIGHT;
            if (i === 0) mapCtx.moveTo(x, y);
            else mapCtx.lineTo(x, y);
        });
        mapCtx.closePath();
        mapCtx.fill();
    }

    function isLand(lon, lat) {
        if (!mapImageData) return false;
        while (lon > 180) lon -= 360;
        while (lon < -180) lon += 360;
        const x = Math.floor(((lon + 180) / 360) * MAP_WIDTH);
        const y = Math.floor(((90 - lat) / 180) * MAP_HEIGHT);
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
        const index = (y * MAP_WIDTH + x) * 4;
        return mapImageData.data[index] > 128;
    }

    function resize() {
        width = canvas.width = section.offsetWidth;
        height = canvas.height = section.offsetHeight;
    }

    function draw() {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, width, height);

        const cols = Math.ceil(width / DOT_SPACING) + 1;
        const rows = Math.ceil(height / DOT_SPACING) + 1;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * DOT_SPACING;
                const y = row * DOT_SPACING;

                const lon = ((x + earthOffset) / MAP_WIDTH) * 360 - 180;
                const lat = 90 - (y / MAP_HEIGHT) * 180;

                if (isLand(lon, lat)) {
                    const size = MAX_DOT_SIZE;
                    const brightness = 0.7;

                    const r = Math.floor(DOT_COLOR.r * brightness);
                    const g = Math.floor(DOT_COLOR.g * brightness);
                    const b = Math.floor(DOT_COLOR.b * brightness);

                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    let lastTime = 0;
    function animate(currentTime) {
        const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;

        earthOffset += SCROLL_SPEED * deltaTime;
        if (earthOffset > MAP_WIDTH) earthOffset -= MAP_WIDTH;

        draw();
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    loadAndRenderGeoJSON();
})();
