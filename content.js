console.log("Chrome extension ready to go!");
SendPageText();

async function SendPageText(){
    let response = await RequestFromBackground({command: "PROCESS_PAGE", pageText: getText()});
    console.log(response);
}

async function RequestFromBackground(obj){
    return new Promise((res,rej) => {
        chrome.runtime.sendMessage(obj, response => {
            res(response);
        })
    })
}

function getText(){
    return document.body.innerText;
}