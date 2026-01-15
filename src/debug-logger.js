
window.addEventListener('error', function (event) {
    console.error('GLOBAL ERROR CAUGHT:', event.error);
    // Optional: create a visible alert on screen for the user to screenshot
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.background = 'red';
    div.style.color = 'white';
    div.style.zIndex = '99999';
    div.style.padding = '20px';
    div.innerText = 'GLOBAL ERROR: ' + (event.error ? event.error.stack : event.message);
    document.body.appendChild(div);
});

window.addEventListener('unhandledrejection', function (event) {
    console.error('UNHANDLED REJECTION:', event.reason);
});
