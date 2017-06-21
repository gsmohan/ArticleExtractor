let querystring = require('querystring'),
    http = require('http'),
    jsdom = require("node-jsdom"),
    pdf = require('html-pdf'),
    fs = require('fs');

let apiConfig = {
  host: 'www.prajavani.net',
  archivePath: '/mobile/archive',
  articlePath: '/news',
};


let dirName = './articles';


//TODO:
//1 - passing date as a params
// 1.1 - pass the year and month in YYYY-MM format
// 1.2 - create a dir with arg name only if article is present
//3 - checking null while DOM searching


class PlaceExtractor {

  constructor(places){
    for(let i=0; i<places.length; i++){
      this.fetchPlaceData(places[i])
    }
  }

  createPdf(title, data){
    if (!fs.existsSync(dirName)){
        fs.mkdirSync(dirName);
    }
    pdf.create(data).toStream((err, stream) => {
      stream.pipe(fs.createWriteStream(`${dirName}/${title}.pdf`));
      console.log(`Pdf file saved`);
    });
  }

  extractContentFromHtml(title, html){
    jsdom.env(html, (err, window) => {
      let documentEl = window.document,
          holderEl = documentEl.querySelector('body .container #main_container #article_section .article_body'),
          author = holderEl.querySelector('.article_author'),
          date = holderEl.querySelector('.article_date'),
          summary = holderEl.querySelector('.article_summary'),
          thumbnail = holderEl.querySelector('.article_image'),
          content = holderEl.querySelector('.body'),
          gallery = holderEl.querySelector('.my-gallery');

      let data = `<h1>${(title === null)? '' : title}</h1>
                  ${(author === null)? '' : author.outerHTML}
                  ${(date === null)? '' : date.outerHTML}
                  ${(summary === null)? '' : summary.outerHTML}
                  ${(thumbnail === null)? '' : thumbnail.outerHTML}
                  ${(content === null)? '' : content.outerHTML}
                  ${(gallery === null)? '' : gallery.outerHTML}`;

      this.createPdf(title, data);

    });
  }

  fetchPlaceData(place){
    let { title, url } = place;
    let options = {
      host: apiConfig.host,
      path: `${apiConfig.articlePath}${url}`
    }

    http.request(options, (response)=>{
      let placeData = [];
      response.on('data', (chunk) => {
        placeData.push(chunk);
      });

      response.on('end', () => {
        placeData = Buffer.concat(placeData).toString();
        this.extractContentFromHtml(title, placeData);
      });
    }).end();
  }
}

class CategoryExtractor {

  constructor(){
    this.params = querystring.stringify({arcDate: "2016-12-11"});
    this.options = {
      host: apiConfig.host,
      path: apiConfig.archivePath,
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(this.params)
      }
    }
    this.fetchArchiveData();
  }

  parseArchiveData(data){
    let jsonData = JSON.parse(data, null, 2);
    let category = 'ಪ್ರವಾಸ';
    if(jsonData.hasOwnProperty(category)){
      let placesInfo = jsonData[category];
      new PlaceExtractor(placesInfo);
    }else{
      console.log(`Sorry !! No ${category} Article on this Day`);
    }
  }

  fetchArchiveData(){
    let request = http.request(this.options, (response) => {
        let data = '';
        response.on('data', (chunk) => {
            data += chunk.toString();
        });
        response.on('end', () => {
          this.parseArchiveData(data);
        });
    });

    request.write(this.params);
    request.end();
  }
}

// Start the App.
new CategoryExtractor();
