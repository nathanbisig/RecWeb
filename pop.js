//This function runs on the load of the pop-up widget
GetRecommendations();

//Sends a command to the background script to process page and generate recommendations
async function GetRecommendations(){
    let response = await RequestFromBackground({command: "GET_RECOMMENDATIONS"});
    showRecommendations(response.recommendations);
}

async function RequestFromBackground(obj){
    return new Promise((res,rej) => {
        chrome.runtime.sendMessage(obj, response => {
            res(response);
        })
    })
}

//Formats the recommendations for the HTML in the pop-up widget
var showRecommendations = function(recommendations) {
    var recommendationsHTML = '<ul>';
    for (var key in recommendations){
        var rec = recommendations[key];
        recommendationsHTML +='<li><a href="' + rec.link + '">' + rec.title + '</a><p>' + rec.snippet + '</p></li>';
    }
    recommendationsHTML += '</ul>';
    document.querySelector('._recommendations_list ul').outerHTML = recommendationsHTML;
}