function initSimulation() {
    const { Engine, Render, Events, MouseConstraint, Mouse, World, Bodies, Vertices } = Matter;

    const containerElement = document.querySelector(".tags-container") || document.querySelector(".tags-container2");
    if (!containerElement) return;

    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;

    const engine = Engine.create();
    const world = engine.world;

    // Matter.js Render Setup
    const render = Render.create({
        element: containerElement,
        engine: engine,
        options: {
            width: containerWidth,
            height: containerHeight,
            pixelRatio: window.devicePixelRatio > 1 ? 2 : 1,
            background: "transparent",
            wireframes: false,
        },
    });

    // Background Image via CSS
    Object.assign(containerElement.style, {
        backgroundImage: "url('./assets/img/home-2/technology-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
    });

    // Boundaries
    const bounds = [
        Bodies.rectangle(containerWidth / 2, containerHeight + 80, containerWidth + 320, 160, { isStatic: true }),
        Bodies.rectangle(-80, containerHeight / 2, 160, containerHeight, { isStatic: true }),
        Bodies.rectangle(containerWidth + 80, containerHeight / 2, 160, containerHeight, { isStatic: true }),
        Bodies.rectangle(containerWidth / 2, -80, containerWidth + 320, 160, { isStatic: true }),
    ];

    // Matter.js Objects
    const ASSETS = "./assets/img/mattericon/";
    const radius = 20;

    const items = [
        { x: containerWidth / 2 + 150, y: 500, w: 164, h: 56, img: "t1.png" },
        { x: containerWidth / 2 - 150, y: 460, w: 122, h: 56, img: "t2.png" },
        { x: containerWidth / 2 + 250, y: 420, w: 204, h: 56, img: "t3.png" },
        { x: containerWidth / 2 - 75,  y: 380, w: 204, h: 56, img: "t4.png" },
        { x: containerWidth / 2 - 74,  y: 540, w: 194, h: 56, img: "t5.png" },
        { x: containerWidth / 2 + 174, y: 490, w: 216, h: 56, img: "t6.png" },
        { x: containerWidth / 2 - 142, y: 440, w: 167, h: 56, img: "t7.png" },
        { x: containerWidth / 2 - 10,  y: 260, w: 260, h: 56, img: "t8.png" },
        { x: containerWidth / 2 - 242, y: 420, w: 174, h: 56, img: "t9.png" },
    ].map(({ x, y, w, h, img }) =>
        Bodies.rectangle(x, y, w, h, {
            chamfer: { radius },
            render: { sprite: { texture: `${ASSETS}${img}`, xScale: 1, yScale: 1 } },
        })
    );

    World.add(world, [...bounds, ...items]);

    // Mouse
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(world, mouseConstraint);
    render.mouse = mouse;

    // Remove wheel event
    ["wheel", "mousewheel", "DOMMouseScroll"].forEach(eventName => {
        mouse.element.removeEventListener(eventName, mouse.mousewheel);
    });

    let isClick = false;
    const handleMouseDown = () => (isClick = true);
    const handleMouseMove = () => (isClick = false);

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);

    Events.on(mouseConstraint, "mouseup", function () {
        if (!mouseConstraint.bodyB && isClick) {
            engine.world.bodies.forEach(body => {
                if (Vertices.contains(body.vertices, mouseConstraint.mouse.position) && body.url) {
                    window.open(body.url, "_blank");
                }
            });
        }
    });

    Engine.run(engine);
    Render.run(render);

    // Responsive Resize (Recommended for ThemeForest)
    window.addEventListener("resize", () => {
        const newWidth = containerElement.clientWidth;
        const newHeight = containerElement.clientHeight;
        render.canvas.width = newWidth;
        render.canvas.height = newHeight;
        render.options.width = newWidth;
        render.options.height = newHeight;
    });
}

// Intersection Observer Initialization
(function () {
    const containerElement = document.querySelector(".tags-container") || document.querySelector(".tags-container2");
    if (!containerElement) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                initSimulation();
                observer.disconnect(); // Stop observing after first load
            }
        });
    });
    observer.observe(containerElement);
})();
