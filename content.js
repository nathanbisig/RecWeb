//This function runs on page load
SendPageText();

//Sends a command to the background script to process page and generate recommendations
async function SendPageText(){
    let response = await RequestFromBackground({command: "PROCESS_PAGE", pageText: getText(), pageUrl: getUrl()});
}

async function RequestFromBackground(obj){
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(obj, response => {
            resolve(response);
        })
    })
}

//Gets the text of the current page
function getText(){
    return document.body.innerText;
}

//Gets the url of the current page
function getUrl(){
    return document.location.href;
}