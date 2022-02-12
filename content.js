console.log("Chrome extension ready to go!");


function getText(){
    return document.body.innerText;
}

chrome.runtime.sendMessage({pageText: getText()}, function(response) {
    console.log(response.status);
  });