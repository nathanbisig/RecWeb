console.log("Content Script Started");

SendPageText();

async function SendPageText(){
    let response = await RequestFromBackground({command: "PROCESS_PAGE", pageText: getText(), pageUrl: getUrl()});
    console.log(response);
}

async function RequestFromBackground(obj){
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(obj, response => {
            resolve(response);
        })
    })
}

function getText(){
    return document.body.innerText;
}

function getUrl(){
    return document.location.href;
}