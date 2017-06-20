let querystring = require('querystring');
let http = require('http');
let jsdom = require("node-jsdom");
let pdf = require('html-pdf');
let fs = require('fs');

//TODO:
//1 - passing date as a params
//2 - removing the dupicate places

class PlaceExtractor {
  constructor(props){
    //Will get the array of places
    for(let i=0; i<props.length; i++){
      this.fetchPlace(props[i])
    }
  }

  fetchPlace(place){
    let { title, url } = place;
    let options = {
      host: 'www.prajavani.net',
      path: `/news${url}`
    }

    http.request(options, (response)=>{
      let placeData = [];
      response.on('data', function (chunk) {
        placeData.push(chunk);
      });

      response.on('end', function () {
        placeData = Buffer.concat(placeData).toString();
        jsdom.env(placeData, (err, window) => {
          let documentEl = window.document,
              holderEl = documentEl.querySelector('body .container #main_container #article_section .article_body'),
              author = holderEl.querySelector('.article_author').outerHTML,
              date = holderEl.querySelector('.article_date').outerHTML,
              summary = holderEl.querySelector('.article_summary').outerHTML,
              thumbnail = holderEl.querySelector('.article_image').outerHTML,
              content = holderEl.querySelector('.body').outerHTML,
              gallery = holderEl.querySelector('.my-gallery').outerHTML;

              let doc = `<h1>${title}</h1>
              <div>${author} @ ${date}</div>
              ${summary}
              ${thumbnail}
              ${content}
              ${gallery}`;

              pdf.create(doc).toStream((err, stream) => {
                stream.pipe(fs.createWriteStream(`./articles/${title}.pdf`));
                console.log(`${title}.pdf file saved`);
              });

        });
       // End of jsdom
      });
      // End of response End
    }).end();
  }
}

class CategoryExtractor {
  constructor(){
    this.params = querystring.stringify({arcDate: "2017-02-19"});
    this.archiveOptions = {
      host: 'www.prajavani.net',
      path: '/mobile/archive',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(this.params)
      }
    }

  }

  parseArchiveData(data){
    let jsonData = JSON.parse(data, null, 2);
    let prop = 'ಪ್ರವಾಸ';
    if(jsonData.hasOwnProperty(prop)){
      //console.log('Found Artical or Place', jsonData[prop]);
      let placesInfo = jsonData[prop];
      //TODO: again fetch and save page
      new PlaceExtractor(placesInfo);
    }else{
      console.log(`Sorry !! No ${prop} Artical on this Day`);
    }
  }

  fetchArchive(){
    let request = http.request(this.archiveOptions, (response) => {
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

let App = new CategoryExtractor();
    App.fetchArchive();
