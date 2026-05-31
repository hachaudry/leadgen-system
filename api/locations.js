// api/locations.js — California Hyperlocal Location Data (embedded, no file-system reads)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const type          = req.query.type
  const countyId      = req.query.countyId
  const cityId        = req.query.cityId
  const neighborhoodId = req.query.neighborhoodId

  if (type === 'counties') {
    return res.status(200).json({
      success: true,
      data: [
        {id:'los-angeles',      name:'Los Angeles County'},
        {id:'orange',           name:'Orange County'},
        {id:'san-diego',        name:'San Diego County'},
        {id:'san-francisco',    name:'San Francisco County'},
        {id:'santa-clara',      name:'Santa Clara County'},
        {id:'alameda',          name:'Alameda County'},
        {id:'contra-costa',     name:'Contra Costa County'},
        {id:'riverside',        name:'Riverside County'},
        {id:'san-bernardino',   name:'San Bernardino County'},
        {id:'sacramento',       name:'Sacramento County'},
        {id:'ventura',          name:'Ventura County'},
        {id:'fresno',           name:'Fresno County'},
        {id:'kern',             name:'Kern County'},
        {id:'san-mateo',        name:'San Mateo County'},
        {id:'sonoma',           name:'Sonoma County'},
        {id:'monterey',         name:'Monterey County'},
        {id:'santa-barbara',    name:'Santa Barbara County'},
        {id:'solano',           name:'Solano County'},
        {id:'marin',            name:'Marin County'},
        {id:'napa',             name:'Napa County'},
        {id:'san-joaquin',      name:'San Joaquin County'},
        {id:'stanislaus',       name:'Stanislaus County'},
        {id:'tulare',           name:'Tulare County'},
        {id:'merced',           name:'Merced County'},
        {id:'butte',            name:'Butte County'},
        {id:'shasta',           name:'Shasta County'},
        {id:'el-dorado',        name:'El Dorado County'},
        {id:'placer',           name:'Placer County'},
        {id:'humboldt',         name:'Humboldt County'},
        {id:'mendocino',        name:'Mendocino County'},
        {id:'imperial',         name:'Imperial County'},
        {id:'kings',            name:'Kings County'},
        {id:'madera',           name:'Madera County'},
        {id:'santa-cruz',       name:'Santa Cruz County'},
        {id:'yolo',             name:'Yolo County'},
        {id:'sutter',           name:'Sutter County'},
        {id:'yuba',             name:'Yuba County'},
        {id:'tehama',           name:'Tehama County'},
        {id:'san-luis-obispo',  name:'San Luis Obispo County'},
        {id:'nevada',           name:'Nevada County'},
        {id:'lake',             name:'Lake County'},
        {id:'colusa',           name:'Colusa County'},
        {id:'glenn',            name:'Glenn County'},
        {id:'siskiyou',         name:'Siskiyou County'},
        {id:'del-norte',        name:'Del Norte County'},
        {id:'trinity',          name:'Trinity County'},
        {id:'lassen',           name:'Lassen County'},
        {id:'plumas',           name:'Plumas County'},
        {id:'modoc',            name:'Modoc County'},
        {id:'sierra',           name:'Sierra County'},
        {id:'alpine',           name:'Alpine County'},
        {id:'mono',             name:'Mono County'},
        {id:'inyo',             name:'Inyo County'},
        {id:'san-benito',       name:'San Benito County'},
        {id:'calaveras',        name:'Calaveras County'},
        {id:'tuolumne',         name:'Tuolumne County'},
        {id:'amador',           name:'Amador County'},
        {id:'mariposa',         name:'Mariposa County'}
      ]
    })
  }

  if (type === 'cities' && countyId) {
    const cities = getCitiesByCounty(countyId)
    return res.status(200).json({ success: true, data: cities })
  }

  if (type === 'neighborhoods' && cityId) {
    const neighborhoods = getNeighborhoodsByCity(cityId)
    return res.status(200).json({ success: true, data: neighborhoods })
  }

  if (type === 'zipcodes' && (cityId || neighborhoodId)) {
    const zips = getZipsByCity(cityId || '')
    return res.status(200).json({ success: true, data: zips })
  }

  return res.status(400).json({ success: false, error: 'Invalid request', data: [] })
}

function getCitiesByCounty(countyId) {
  const cities = {
    'los-angeles': ['Los Angeles','Long Beach','Glendale','Santa Clarita','Lancaster','Palmdale','Pomona','Torrance','Pasadena','El Monte','Downey','West Covina','Norwalk','Burbank','Compton','South Gate','Carson','Santa Monica','Hawthorne','Whittier','Alhambra','Inglewood','Beverly Hills','Culver City','West Hollywood','Malibu','Calabasas','Hermosa Beach','Manhattan Beach','El Segundo','Gardena','Lynwood','Pico Rivera','Montebello','Covina','Azusa','Glendora','Claremont','San Dimas','La Verne','Monrovia','Temple City','Rosemead','San Gabriel','San Marino','South Pasadena','Van Nuys','Sherman Oaks','Studio City','Encino','Tarzana','Woodland Hills','Hollywood','Silver Lake','Echo Park','Los Feliz','Venice','Marina del Rey'],
    'orange': ['Anaheim','Santa Ana','Irvine','Huntington Beach','Garden Grove','Fullerton','Orange','Costa Mesa','Mission Viejo','Westminster','Newport Beach','Buena Park','Lake Forest','Tustin','Yorba Linda','San Clemente','Laguna Niguel','Laguna Hills','Dana Point','San Juan Capistrano','Aliso Viejo','Laguna Beach','Placentia','Cypress','La Habra','Fountain Valley','Stanton','Brea','La Palma','Seal Beach','Los Alamitos','Rancho Santa Margarita'],
    'san-diego': ['San Diego','Chula Vista','Oceanside','Escondido','Carlsbad','El Cajon','Santee','Encinitas','Poway','National City','La Mesa','Lemon Grove','Coronado','Imperial Beach','Del Mar','Solana Beach','Pacific Beach','Mission Beach','Ocean Beach','Point Loma','Old Town','North Park','Hillcrest','La Jolla','Mira Mesa','Rancho Bernardo','Carmel Valley'],
    'san-francisco': ['San Francisco'],
    'santa-clara': ['San Jose','Sunnyvale','Santa Clara','Mountain View','Palo Alto','Milpitas','Campbell','Cupertino','Saratoga','Los Gatos','Los Altos','Gilroy','Morgan Hill','Monte Sereno'],
    'alameda': ['Oakland','Fremont','Hayward','Berkeley','Newark','Union City','Emeryville','Pleasanton','Livermore','Dublin','San Leandro','Albany','Piedmont','Alameda'],
    'contra-costa': ['Concord','Richmond','Antioch','Walnut Creek','Pittsburg','San Ramon','Brentwood','Oakley','Pleasant Hill','Martinez','El Cerrito','Hercules','Lafayette','Orinda','Moraga','Danville'],
    'riverside': ['Riverside','Moreno Valley','Corona','Murrieta','Temecula','Menifee','Jurupa Valley','Hemet','Indio','Desert Hot Springs','Palm Springs','Palm Desert','La Quinta','Cathedral City','Perris','Lake Elsinore','Eastvale','Norco','Banning','Beaumont'],
    'san-bernardino': ['San Bernardino','Fontana','Rancho Cucamonga','Ontario','Victorville','Rialto','Hesperia','Chino','Upland','Colton','Apple Valley','Chino Hills','Redlands','Highland','Yucaipa','Montclair','Loma Linda','Adelanto','Barstow','Big Bear Lake'],
    'sacramento': ['Sacramento','Elk Grove','Citrus Heights','Folsom','Rancho Cordova','West Sacramento','Roseville','Davis','Woodland'],
    'ventura': ['Oxnard','Thousand Oaks','Simi Valley','Ventura','Camarillo','Moorpark','Santa Paula','Fillmore','Ojai','Port Hueneme'],
    'fresno': ['Fresno','Clovis','Sanger','Selma','Kingsburg','Reedley','Coalinga','Mendota'],
    'kern': ['Bakersfield','Delano','Ridgecrest','Tehachapi','Wasco','Shafter','Arvin'],
    'san-mateo': ['Daly City','San Mateo','Redwood City','South San Francisco','San Bruno','Burlingame','Millbrae','Foster City','Belmont','San Carlos','Menlo Park','Half Moon Bay','Pacifica'],
    'sonoma': ['Santa Rosa','Petaluma','Rohnert Park','Windsor','Healdsburg','Sebastopol','Sonoma','Cotati','Cloverdale'],
    'monterey': ['Salinas','Monterey','Pacific Grove','Carmel-by-the-Sea','Marina','Seaside','Soledad','King City'],
    'santa-barbara': ['Santa Barbara','Santa Maria','Lompoc','Goleta','Carpinteria','Buellton','Solvang'],
    'solano': ['Vallejo','Fairfield','Vacaville','Benicia','Dixon','Suisun City'],
    'marin': ['San Rafael','Novato','Mill Valley','San Anselmo','Fairfax','Corte Madera','Larkspur','Tiburon','Sausalito'],
    'napa': ['Napa','St. Helena','Calistoga','Yountville','American Canyon'],
    'san-joaquin': ['Stockton','Tracy','Lodi','Manteca'],
    'stanislaus': ['Modesto','Turlock','Ceres','Riverbank','Oakdale','Patterson'],
    'tulare': ['Visalia','Porterville','Tulare','Dinuba','Exeter'],
    'merced': ['Merced','Atwater','Los Banos','Livingston'],
    'butte': ['Chico','Oroville','Paradise'],
    'shasta': ['Redding','Anderson'],
    'el-dorado': ['Placerville','South Lake Tahoe','El Dorado Hills'],
    'placer': ['Roseville','Rocklin','Auburn','Lincoln'],
    'humboldt': ['Eureka','Arcata','Fortuna'],
    'mendocino': ['Ukiah','Willits','Fort Bragg'],
    'imperial': ['El Centro','Calexico','Brawley','Imperial'],
    'kings': ['Hanford','Lemoore','Corcoran'],
    'madera': ['Madera','Chowchilla'],
    'santa-cruz': ['Santa Cruz','Watsonville','Capitola','Scotts Valley'],
    'yolo': ['Davis','Woodland','West Sacramento','Winters'],
    'san-luis-obispo': ['San Luis Obispo','Paso Robles','Atascadero','Morro Bay','Arroyo Grande','Pismo Beach'],
    'nevada': ['Nevada City','Grass Valley','Truckee'],
    'lake': ['Lakeport','Clearlake'],
    'sutter': ['Yuba City','Live Oak'],
    'yuba': ['Marysville'],
    'tehama': ['Red Bluff','Corning'],
    'siskiyou': ['Yreka','Mount Shasta','Weed'],
    'del-norte': ['Crescent City'],
    'lassen': ['Susanville'],
    'plumas': ['Quincy','Portola'],
    'inyo': ['Bishop','Lone Pine'],
    'mono': ['Mammoth Lakes'],
    'san-benito': ['Hollister'],
    'calaveras': ['San Andreas','Angels Camp'],
    'tuolumne': ['Sonora'],
    'amador': ['Jackson'],
    'mariposa': ['Mariposa'],
    'colusa': ['Colusa','Williams'],
    'glenn': ['Willows','Orland'],
    'modoc': ['Alturas'],
    'sierra': ['Downieville'],
    'alpine': ['Markleeville'],
    'trinity': ['Weaverville']
  }
  const cityNames = cities[countyId] || []
  return cityNames.map(name => ({
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
    name: name,
    countyId: countyId,
    state: 'CA'
  }))
}

function getNeighborhoodsByCity(cityId) {
  const neighborhoods = {
    'los-angeles': ['Hollywood','West Hollywood','Silver Lake','Echo Park','Los Feliz','Koreatown','Mid-Wilshire','Hancock Park','Fairfax','West Adams','Leimert Park','Venice','Marina del Rey','Westwood','Century City','Beverly Hills','Bel Air','Brentwood','Downtown LA','Arts District','Little Tokyo','Chinatown','Boyle Heights','Eagle Rock','Highland Park','Atwater Village','Culver City','Mar Vista','Playa del Rey','Van Nuys','Sherman Oaks','Studio City','Encino','Tarzana','Woodland Hills','Canoga Park','Chatsworth','Granada Hills','Northridge','Reseda','Sylmar','Pacoima','Panorama City','North Hollywood'],
    'san-francisco': ['Financial District','SoMa','Mission District','Castro','Noe Valley','Bernal Heights','Potrero Hill','Dogpatch','Bayview','Excelsior','Glen Park','Twin Peaks','Inner Sunset','Outer Sunset','Inner Richmond','Outer Richmond','Pacific Heights','Cow Hollow','Marina','North Beach','Chinatown','Tenderloin','Hayes Valley','Haight-Ashbury','Russian Hill','Nob Hill','Union Square'],
    'san-diego': ['Gaslamp Quarter','Downtown','Little Italy','Hillcrest','North Park','South Park','Golden Hill','Normal Heights','University Heights','Mission Hills','Old Town','Mission Valley','Pacific Beach','Mission Beach','Ocean Beach','Point Loma','La Jolla','Mira Mesa','Rancho Bernardo','Carmel Valley','City Heights','Barrio Logan'],
    'san-jose': ['Downtown','Willow Glen','Rose Garden','Naglee Park','Japantown','Alum Rock','East San Jose','Evergreen','Blossom Valley','Almaden Valley','Santa Teresa','Berryessa','North Valley'],
    'oakland': ['Downtown Oakland','Uptown','Lake Merritt','Grand Lake','Temescal','Rockridge','Piedmont Avenue','Montclair','Fruitvale','San Antonio','Eastlake','Glenview','Laurel','Dimond'],
    'santa-rosa': ['Downtown','Railroad Square','Fountaingrove','Bennett Valley','Rincon Valley','Oakmont','Southwest','Roseland','Coffey Park'],
    'petaluma': ['Downtown','East Petaluma','West Petaluma','South Petaluma'],
    'rohnert-park': ['Southeast','Northeast','Northwest','Southwest','Sonoma State Area'],
    'sacramento': ['Downtown','Midtown','Land Park','Curtis Park','Oak Park','Tahoe Park','Natomas','North Sacramento','South Sacramento','Pocket-Greenhaven'],
    'fresno': ['Downtown','Tower District','Fig Garden','Old Fig Garden','Sunnyside','Woodward Park','Northwest Fresno'],
    'bakersfield': ['Downtown','Oleander-Sunset','Stockdale','Southwest','East Bakersfield'],
    'riverside': ['Downtown','Wood Streets','Alessandro Heights','Canyon Crest','La Sierra','Orangecrest'],
    'anaheim': ['Downtown Anaheim','Anaheim Hills','Anaheim Resort District','West Anaheim'],
    'irvine': ['University Park','Woodbridge','Northwood','Westpark','Turtle Rock','Shady Canyon','Portola Springs','Great Park','Stonegate','Cypress Village'],
    'long-beach': ['Downtown Long Beach','Belmont Shore','Naples','Alamitos Beach','Bixby Knolls','California Heights'],
    'santa-barbara': ['Downtown','Funk Zone','Eastside','Westside','Mesa','Mission Canyon','Montecito'],
    'pasadena': ['Downtown Pasadena','Old Pasadena','South Lake','Bungalow Heaven','Hastings Ranch','San Rafael'],
    'burbank': ['Downtown Burbank','Magnolia Park','Media District','Rancho'],
    'glendale': ['Downtown Glendale','Montrose','La Crescenta','Adams Hill','Chevy Chase'],
    'napa': ['Downtown Napa','Browns Valley','Silverado','Alta Heights','Coombsville'],
    'modesto': ['Downtown','Sylvan','Beyer Park','Village One'],
    'stockton': ['Downtown','Victory Park','Lincoln Village','Brookside','Weston Ranch'],
    'oxnard': ['Downtown','Colonia','Riverpark','Silver Strand','Hollywood Beach']
  }
  const nbs = neighborhoods[cityId] || []
  return nbs.map(name => ({
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
    name: name,
    cityId: cityId,
    state: 'CA',
    source: 'local'
  }))
}

function getZipsByCity(cityId) {
  const zips = {
    'los-angeles': ['90001','90004','90005','90006','90007','90008','90010','90011','90012','90013','90014','90015','90016','90017','90018','90019','90020','90021','90024','90025','90026','90027','90028','90029','90034','90035','90036','90038','90046','90048','90049','90056','90064','90065','90066','90067','90068','90210','90211','90212','90230','90232','90272','90291','90292','90293'],
    'san-francisco': ['94102','94103','94104','94105','94107','94108','94109','94110','94111','94112','94114','94115','94116','94117','94118','94121','94122','94123','94124','94131','94132','94133','94134'],
    'san-diego': ['92101','92102','92103','92104','92105','92106','92107','92108','92109','92110','92111','92113','92114','92115','92116','92117','92119','92120','92121','92122','92123','92124','92126','92127','92128','92129','92130','92131'],
    'san-jose': ['95101','95110','95111','95112','95113','95116','95117','95118','95119','95120','95121','95122','95123','95124','95125','95126','95127','95128','95129','95130','95131','95132','95133','95134','95135','95136','95138','95139'],
    'irvine': ['92602','92603','92604','92606','92612','92614','92617','92618','92620'],
    'oakland': ['94601','94602','94603','94605','94606','94607','94608','94609','94610','94611','94612','94618','94619','94621'],
    'anaheim': ['92801','92802','92804','92805','92806','92807','92808'],
    'long-beach': ['90802','90803','90804','90805','90806','90807','90808','90810','90813','90814','90815'],
    'fresno': ['93701','93702','93703','93704','93705','93706','93710','93711','93720','93721','93722','93726','93727','93728'],
    'sacramento': ['95811','95814','95815','95816','95817','95818','95819','95820','95821','95822','95823','95824','95825','95826','95827','95828','95831','95833','95834','95835','95838'],
    'bakersfield': ['93301','93304','93305','93306','93307','93308','93309','93311','93312','93313'],
    'riverside': ['92501','92503','92504','92505','92506','92507','92508'],
    'santa-rosa': ['95401','95402','95403','95404','95405','95406','95407','95409'],
    'rohnert-park': ['94927','94928'],
    'petaluma': ['94952','94953','94954','94955'],
    'napa': ['94558','94559'],
    'stockton': ['95201','95202','95203','95204','95205','95206','95207','95209','95210'],
    'modesto': ['95350','95351','95354','95355','95356','95357','95358'],
    'oxnard': ['93030','93033','93035','93036'],
    'burbank': ['91501','91502','91504','91505','91506'],
    'glendale': ['91201','91202','91203','91204','91205','91206'],
    'pasadena': ['91101','91103','91104','91105','91106','91107'],
    'santa-barbara': ['93101','93103','93105','93108','93109','93110','93111']
  }
  const zipList = zips[cityId] || []
  return zipList.map(zip => ({ zip, cityId, state: 'CA', source: 'local' }))
}
