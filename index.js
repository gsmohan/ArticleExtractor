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
    this.yearMonth = process.argv[2],
    this.days = this.daysInMonth(),
    this.params = null,
    this.options = null;

    for(let i=1; i<=this.days; i++){
      let date = this.getDateFormat(i);
      this.params = querystring.stringify({arcDate: date});
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
  }

  getDateFormat(n){
    let day = (n < 10)? '0'+n : ''+n;
    return `${this.yearMonth}-${day}`;
  }

  daysInMonth() {
    let date = this.yearMonth.split('-'),
        year = date[0],
        month = date[1];
    return new Date(year, month, 0).getDate();
  }

  parseArchiveData(data){
    let jsonData = JSON.parse(data, null, 2);
    let category = 'ಪ್ರವಾಸ';
    if(jsonData.hasOwnProperty(category)){
      let placesInfo = jsonData[category];
      new PlaceExtractor(placesInfo);
    }else{
      //console.log(`Sorry !! No ${category} Article on this day`);
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
