chrome.app.runtime.onLaunched.addListener(function()
{
	chrome.app.window.create('ssdp.html', {
		width: 330,
		height: 530	
	});
	
});
