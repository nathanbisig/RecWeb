GetRecommendations();

async function GetRecommendations(){
    let response = await RequestFromBackground({command: "GET_RECOMMENDATIONS"});
    console.log(response);
    showRecommendations(response.recommendations);
}

async function RequestFromBackground(obj){
    return new Promise((res,rej) => {
        chrome.runtime.sendMessage(obj, response => {
            res(response);
        })
    })
}

var showRecommendations = function(recommendations) {
    var recommendationsHTML = '<ul>';
    for (var key in recommendations){
        var rec = recommendations[key];
        recommendationsHTML +='<li><a href="' + rec.link + '">' + rec.label + '</a><p>' + rec.text + '</p></li>';
    }
    recommendationsHTML += '</ul>';
    document.querySelector('._recommendations_list ul').outerHTML = recommendationsHTML;
}