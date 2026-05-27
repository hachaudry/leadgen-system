// api/locations.js — California Hyperlocal Location Data
// All data is embedded directly — no file-system reads, works in any Vercel environment.

// Normalize a name to a URL-safe id key
function toKey(name) {
  return (name || '').toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Embedded Data ──────────────────────────────────────────────────────────

const CALIFORNIA_COUNTIES = [
  { id: 'alameda',         name: 'Alameda County',         state: 'CA' },
  { id: 'alpine',          name: 'Alpine County',          state: 'CA' },
  { id: 'amador',          name: 'Amador County',          state: 'CA' },
  { id: 'butte',           name: 'Butte County',           state: 'CA' },
  { id: 'calaveras',       name: 'Calaveras County',       state: 'CA' },
  { id: 'colusa',          name: 'Colusa County',          state: 'CA' },
  { id: 'contra-costa',    name: 'Contra Costa County',    state: 'CA' },
  { id: 'del-norte',       name: 'Del Norte County',       state: 'CA' },
  { id: 'el-dorado',       name: 'El Dorado County',       state: 'CA' },
  { id: 'fresno',          name: 'Fresno County',          state: 'CA' },
  { id: 'glenn',           name: 'Glenn County',           state: 'CA' },
  { id: 'humboldt',        name: 'Humboldt County',        state: 'CA' },
  { id: 'imperial',        name: 'Imperial County',        state: 'CA' },
  { id: 'inyo',            name: 'Inyo County',            state: 'CA' },
  { id: 'kern',            name: 'Kern County',            state: 'CA' },
  { id: 'kings',           name: 'Kings County',           state: 'CA' },
  { id: 'lake',            name: 'Lake County',            state: 'CA' },
  { id: 'lassen',          name: 'Lassen County',          state: 'CA' },
  { id: 'los-angeles',     name: 'Los Angeles County',     state: 'CA' },
  { id: 'madera',          name: 'Madera County',          state: 'CA' },
  { id: 'marin',           name: 'Marin County',           state: 'CA' },
  { id: 'mariposa',        name: 'Mariposa County',        state: 'CA' },
  { id: 'mendocino',       name: 'Mendocino County',       state: 'CA' },
  { id: 'merced',          name: 'Merced County',          state: 'CA' },
  { id: 'modoc',           name: 'Modoc County',           state: 'CA' },
  { id: 'mono',            name: 'Mono County',            state: 'CA' },
  { id: 'monterey',        name: 'Monterey County',        state: 'CA' },
  { id: 'napa',            name: 'Napa County',            state: 'CA' },
  { id: 'nevada',          name: 'Nevada County',          state: 'CA' },
  { id: 'orange',          name: 'Orange County',          state: 'CA' },
  { id: 'placer',          name: 'Placer County',          state: 'CA' },
  { id: 'plumas',          name: 'Plumas County',          state: 'CA' },
  { id: 'riverside',       name: 'Riverside County',       state: 'CA' },
  { id: 'sacramento',      name: 'Sacramento County',      state: 'CA' },
  { id: 'san-benito',      name: 'San Benito County',      state: 'CA' },
  { id: 'san-bernardino',  name: 'San Bernardino County',  state: 'CA' },
  { id: 'san-diego',       name: 'San Diego County',       state: 'CA' },
  { id: 'san-francisco',   name: 'San Francisco County',   state: 'CA' },
  { id: 'san-joaquin',     name: 'San Joaquin County',     state: 'CA' },
  { id: 'san-luis-obispo', name: 'San Luis Obispo County', state: 'CA' },
  { id: 'san-mateo',       name: 'San Mateo County',       state: 'CA' },
  { id: 'santa-barbara',   name: 'Santa Barbara County',   state: 'CA' },
  { id: 'santa-clara',     name: 'Santa Clara County',     state: 'CA' },
  { id: 'santa-cruz',      name: 'Santa Cruz County',      state: 'CA' },
  { id: 'shasta',          name: 'Shasta County',          state: 'CA' },
  { id: 'sierra',          name: 'Sierra County',          state: 'CA' },
  { id: 'siskiyou',        name: 'Siskiyou County',        state: 'CA' },
  { id: 'solano',          name: 'Solano County',          state: 'CA' },
  { id: 'sonoma',          name: 'Sonoma County',          state: 'CA' },
  { id: 'stanislaus',      name: 'Stanislaus County',      state: 'CA' },
  { id: 'sutter',          name: 'Sutter County',          state: 'CA' },
  { id: 'tehama',          name: 'Tehama County',          state: 'CA' },
  { id: 'trinity',         name: 'Trinity County',         state: 'CA' },
  { id: 'tulare',          name: 'Tulare County',          state: 'CA' },
  { id: 'tuolumne',        name: 'Tuolumne County',        state: 'CA' },
  { id: 'ventura',         name: 'Ventura County',         state: 'CA' },
  { id: 'yolo',            name: 'Yolo County',            state: 'CA' },
  { id: 'yuba',            name: 'Yuba County',            state: 'CA' }
];

const CITIES_BY_COUNTY = {
  'los-angeles':    ['Los Angeles','Long Beach','Glendale','Santa Clarita','Lancaster','Palmdale','Pomona','Torrance','Pasadena','El Monte','Downey','West Covina','Norwalk','Burbank','Compton','South Gate','Carson','Santa Monica','Hawthorne','Whittier','Alhambra','Inglewood','Lakewood','Bellflower','Baldwin Park','Monterey Park','Redondo Beach','Arcadia','Diamond Bar','Manhattan Beach','Beverly Hills','Culver City','West Hollywood','Malibu','Calabasas','Hermosa Beach','El Segundo','Gardena','Lynwood','Pico Rivera','Montebello','Covina','Azusa','Glendora','Claremont','San Dimas','La Verne','Monrovia','Temple City','Rosemead','San Gabriel','San Marino','South Pasadena','La Canada Flintridge','Sylmar','Reseda','Canoga Park','Chatsworth','Granada Hills','Northridge','Van Nuys','Sherman Oaks','Studio City','Encino','Tarzana','Woodland Hills'],
  'orange':         ['Anaheim','Santa Ana','Irvine','Huntington Beach','Garden Grove','Fullerton','Orange','Costa Mesa','Mission Viejo','Westminster','Newport Beach','Buena Park','Lake Forest','Tustin','Yorba Linda','San Clemente','Laguna Niguel','Laguna Hills','Dana Point','San Juan Capistrano','Aliso Viejo','Laguna Beach','Placentia','Cypress','La Habra','Fountain Valley','Stanton','Brea','La Palma','Seal Beach','Los Alamitos','Rancho Santa Margarita','Coto de Caza','Ladera Ranch'],
  'san-diego':      ['San Diego','Chula Vista','Oceanside','Escondido','Carlsbad','El Cajon','Santee','Encinitas','Poway','National City','La Mesa','Lemon Grove','Coronado','Imperial Beach','Del Mar','Solana Beach','Pacific Beach','Mission Beach','Ocean Beach','Point Loma','Old Town','North Park','Hillcrest','Normal Heights','University Heights','South Park','Golden Hill','Barrio Logan','City Heights','Kearny Mesa','Mission Valley','Linda Vista','Bay Park','Clairemont','Mira Mesa','Miramar','Scripps Ranch','Tierrasanta','Serra Mesa','Carmel Valley','La Jolla','Rancho Bernardo','Rancho Penasquitos','Black Mountain Ranch'],
  'san-francisco':  ['San Francisco'],
  'santa-clara':    ['San Jose','Sunnyvale','Santa Clara','Mountain View','Palo Alto','Milpitas','Campbell','Cupertino','Saratoga','Los Gatos','Los Altos','Los Altos Hills','Gilroy','Morgan Hill','Monte Sereno'],
  'alameda':        ['Oakland','Fremont','Hayward','Berkeley','Newark','Union City','Emeryville','Pleasanton','Livermore','Dublin','San Leandro','Albany','Piedmont','Alameda'],
  'contra-costa':   ['Concord','Richmond','Antioch','Walnut Creek','Pittsburg','San Ramon','Brentwood','Oakley','Pleasant Hill','Martinez','El Cerrito','Hercules','Lafayette','Orinda','Moraga','Danville','Clayton'],
  'sacramento':     ['Sacramento','Elk Grove','Citrus Heights','Folsom','Rancho Cordova','West Sacramento','Roseville','Davis','Woodland'],
  'fresno':         ['Fresno','Clovis','Sanger','Selma','Kingsburg','Fowler','Reedley','Coalinga','Mendota','Firebaugh'],
  'riverside':      ['Riverside','Moreno Valley','Corona','Murrieta','Temecula','Menifee','Jurupa Valley','Hemet','Indio','Desert Hot Springs','Palm Springs','Palm Desert','La Quinta','Cathedral City','Perris','Lake Elsinore','Eastvale','Norco','Banning','Beaumont'],
  'san-bernardino': ['San Bernardino','Fontana','Rancho Cucamonga','Ontario','Victorville','Rialto','Hesperia','Chino','Upland','Colton','Apple Valley','Chino Hills','Redlands','Highland','Yucaipa','Montclair','Loma Linda','Adelanto','Barstow','Big Bear Lake'],
  'ventura':        ['Oxnard','Thousand Oaks','Simi Valley','Ventura','Camarillo','Moorpark','Santa Paula','Fillmore','Ojai','Port Hueneme'],
  'kern':           ['Bakersfield','Delano','Ridgecrest','Tehachapi','Wasco','Shafter','Arvin','McFarland'],
  'monterey':       ['Salinas','Monterey','Pacific Grove','Carmel-by-the-Sea','Marina','Seaside','Soledad','Gonzales','Greenfield','King City'],
  'santa-barbara':  ['Santa Barbara','Santa Maria','Lompoc','Goleta','Carpinteria','Buellton','Solvang','Guadalupe'],
  'san-luis-obispo':['San Luis Obispo','Paso Robles','Atascadero','Morro Bay','Arroyo Grande','Pismo Beach','Grover Beach','Templeton'],
  'sonoma':         ['Santa Rosa','Petaluma','Rohnert Park','Windsor','Healdsburg','Sebastopol','Sonoma','Cotati','Cloverdale'],
  'marin':          ['San Rafael','Novato','Mill Valley','San Anselmo','Fairfax','Corte Madera','Larkspur','Tiburon','Sausalito'],
  'napa':           ['Napa','St. Helena','Calistoga','Yountville','American Canyon'],
  'solano':         ['Vallejo','Fairfield','Vacaville','Benicia','Dixon','Rio Vista','Suisun City'],
  'san-mateo':      ['Daly City','San Mateo','Redwood City','South San Francisco','San Bruno','Burlingame','Millbrae','Foster City','Belmont','San Carlos','Menlo Park','Atherton','Portola Valley','Woodside','Half Moon Bay','Pacifica'],
  'san-joaquin':    ['Stockton','Tracy','Lodi','Manteca','Turlock','Modesto'],
  'stanislaus':     ['Modesto','Turlock','Ceres','Riverbank','Oakdale','Patterson','Newman'],
  'tulare':         ['Visalia','Porterville','Tulare','Dinuba','Exeter','Lindsay','Woodlake'],
  'butte':          ['Chico','Oroville','Paradise','Gridley','Biggs'],
  'shasta':         ['Redding','Anderson','Shasta Lake'],
  'el-dorado':      ['Placerville','South Lake Tahoe','El Dorado Hills','Cameron Park'],
  'placer':         ['Roseville','Rocklin','Auburn','Lincoln','Loomis','Colfax'],
  'merced':         ['Merced','Atwater','Los Banos','Livingston','Gustine'],
  'kings':          ['Hanford','Lemoore','Corcoran','Avenal'],
  'madera':         ['Madera','Chowchilla','Madera Ranchos'],
  'imperial':       ['El Centro','Calexico','Brawley','Imperial','Holtville'],
  'humboldt':       ['Eureka','Arcata','Fortuna','McKinleyville','Blue Lake'],
  'mendocino':      ['Ukiah','Willits','Fort Bragg','Mendocino','Point Arena'],
  'lake':           ['Lakeport','Clearlake','Clearlake Oaks'],
  'nevada':         ['Nevada City','Grass Valley','Truckee','Penn Valley'],
  'yolo':           ['Davis','Woodland','West Sacramento','Winters','Esparto'],
  'sutter':         ['Yuba City','Live Oak','Meridian'],
  'yuba':           ['Marysville','Wheatland','Olivehurst'],
  'tehama':         ['Red Bluff','Corning','Tehama'],
  'glenn':          ['Willows','Orland'],
  'colusa':         ['Colusa','Williams'],
  'siskiyou':       ['Yreka','Mount Shasta','Weed','Dorris'],
  'modoc':          ['Alturas'],
  'lassen':         ['Susanville','Westwood'],
  'plumas':         ['Quincy','Portola','Chester'],
  'sierra':         ['Downieville','Sierra City'],
  'alpine':         ['Markleeville'],
  'mono':           ['Mammoth Lakes','Bridgeport','Lee Vining'],
  'inyo':           ['Bishop','Big Pine','Lone Pine','Independence'],
  'san-benito':     ['Hollister','San Juan Bautista'],
  'trinity':        ['Weaverville','Hayfork'],
  'del-norte':      ['Crescent City'],
  'calaveras':      ['San Andreas','Angels Camp','Murphys'],
  'tuolumne':       ['Sonora','Jamestown','Groveland'],
  'amador':         ['Jackson','Ione','Plymouth','Sutter Creek'],
  'mariposa':       ['Mariposa','El Portal'],
  'santa-cruz':     ['Santa Cruz','Watsonville','Capitola','Scotts Valley','Aptos']
};

const NEIGHBORHOODS_BY_CITY = {
  'los-angeles':     ['Hollywood','West Hollywood','Silver Lake','Echo Park','Los Feliz','Atwater Village','Eagle Rock','Highland Park','Koreatown','Mid-Wilshire','Hancock Park','Larchmont Village','Fairfax','West Adams','Leimert Park','Crenshaw','Hyde Park','Baldwin Hills','Culver City','Mar Vista','Venice','Marina del Rey','Playa del Rey','Westchester','San Pedro','Watts','Willowbrook','South Central','Exposition Park','University Park','Historic South-Central','Jefferson Park','Adams-Normandie','Pico-Union','Westlake','MacArthur Park','Downtown LA','Arts District','Little Tokyo','Chinatown','Boyle Heights','East LA','El Sereno','Lincoln Heights','Cypress Park','Elysian Valley','Glassell Park','Hermon','Montecito Heights','Monterey Hills','Beverly Hills','Bel Air','Brentwood','Westwood','Century City','Beverlywood','Pico-Robertson','Palms','Cheviot Hills','Rancho Park','Westside Village','Ladera Heights','Windsor Hills','View Park','Melrose','East Hollywood','Little Armenia','Thai Town','Virgil Village','Rampart Village','Canoga Park','West Hills','Woodland Hills','Chatsworth','Granada Hills','Porter Ranch','Northridge','Reseda','Tarzana','Encino','Sherman Oaks','Van Nuys','Panorama City','Arleta','Pacoima','Sylmar','Sun Valley','Tujunga','Sunland','Shadow Hills','Lake View Terrace'],
  'san-francisco':   ['Financial District','SoMa','Mission District','Castro','Noe Valley','Bernal Heights','Potrero Hill','Dogpatch','Bayview','Hunters Point','Excelsior','Outer Mission','Portola','Visitacion Valley','Glen Park','Twin Peaks','Diamond Heights','Glen Canyon','Forest Hill','West Portal','Inner Sunset','Outer Sunset','Inner Richmond','Outer Richmond','Seacliff','Presidio','Pacific Heights','Cow Hollow','Marina','North Beach','Chinatown','Tenderloin','Civic Center','Hayes Valley','Lower Haight','Haight-Ashbury','Cole Valley','Buena Vista','Alamo Square','Western Addition','Japantown','Fillmore','Divisadero','NoPa','Russian Hill','Nob Hill','Union Square','Embarcadero','Rincon Hill','South Beach','Mission Bay'],
  'san-diego':       ['Gaslamp Quarter','Downtown','Little Italy','East Village','Cortez Hill','Bankers Hill','Hillcrest','North Park','South Park','Golden Hill','Normal Heights','Kensington','Talmadge','Allied Gardens','Del Cerro','San Carlos','Navajo','College Area','Rolando','City Heights','Mid-City','Logan Heights','Barrio Logan','Grant Hill','Sherman Heights','Southcrest','Encanto','Chollas View','Lincoln Park','Emerald Hills','Skyline','Paradise Hills','Valencia Park','Broadway Heights','Oak Park','University Heights','Mission Hills','Old Town','Mission Valley','Fashion Valley','Linda Vista','Bay Park','Clairemont','Mira Mesa','Miramar','Scripps Ranch','Tierrasanta','Serra Mesa','Kearny Mesa','Pacific Beach','Mission Beach','Ocean Beach','Point Loma','Liberty Station','Midway','Bay Ho','Sorrento Valley','Carmel Valley','Del Mar Heights','La Jolla','UTC','University City','Torrey Pines','Rancho Penasquitos','Black Mountain Ranch','Rancho Bernardo','Sabre Springs'],
  'san-jose':        ['Downtown','Willow Glen','Rose Garden','Naglee Park','Japantown','Burbank','Alum Rock','East San Jose','Evergreen','Silver Creek','Berryessa','North Valley','Alviso','Blossom Valley','Cambrian','Los Alamitos Creek','Santa Teresa','Almaden Valley','Edenvale','Brooktree'],
  'oakland':         ['Downtown Oakland','Uptown','Lake Merritt','Grand Lake','Temescal','Rockridge','Piedmont Avenue','Montclair','Fruitvale','San Antonio','Eastlake','Cleveland Heights','Glenview','Lincoln Highlands','Maxwell Park','Allendale','Laurel','Dimond','Millsmont','Redwood Heights','Skyline','Thornhill','Joaquin Miller','Woodminster','Reservoir Hill','Sequoyah','Brookfield','Coliseum','Castlemont','Elmhurst','Seminary','Havenscourt','Sobrante Park','Hegenberger','Airport','Harbor'],
  'irvine':          ['University Park','Woodbridge','Northwood','Westpark','Orangetree','Turtle Rock','Shady Canyon','Portola Springs','Great Park Neighborhoods','Stonegate','Cypress Village','Eastwood','El Camino Real','Oak Creek','Rancho San Joaquin','Quail Hill','Laguna Altura','Orchard Hills'],
  'santa-rosa':      ['Downtown','Railroad Square','Fountaingrove','Bennett Valley','Rincon Valley','Oakmont','Southwest Santa Rosa','Roseland','Junior College','Coffey Park','Larkfield'],
  'berkeley':        ['Downtown Berkeley','Elmwood','Claremont','Rockridge','North Berkeley','Gourmet Ghetto','Telegraph Avenue','Southside','West Berkeley','Berkeley Hills','Panoramic Hill','Thousand Oaks'],
  'fresno':          ['Downtown Fresno','Tower District','Fig Garden','Old Fig Garden','Sunnyside','Woodward Park','Clovis adjacent','West Fresno','Hoover','McLane','Bullard','Northwest Fresno'],
  'sacramento':      ['Downtown','Midtown','Land Park','Curtis Park','Oak Park','Tahoe Park','Arden-Arcade','Carmichael','Fair Oaks','Rancho Cordova adjacent','South Sacramento','Pocket-Greenhaven','Natomas','North Sacramento','Del Paso Heights'],
  'long-beach':      ['Downtown Long Beach','Belmont Shore','Naples','Alamitos Beach','Bixby Knolls','California Heights','Wrigley','North Long Beach','Signal Hill','Los Cerritos','Lakewood Village'],
  'anaheim':         ['Downtown Anaheim','Anaheim Hills','Anaheim Resort District','West Anaheim','South Anaheim','Platinum Triangle'],
  'bakersfield':     ['Downtown Bakersfield','Oleander-Sunset','Stockdale','Southwest Bakersfield','East Bakersfield','Oildale','Riverlakes Ranch'],
  'riverside':       ['Downtown Riverside','Wood Streets','Alessandro Heights','Canyon Crest','La Sierra','Orangecrest','Arlington','Magnolia Center','Hunter Park'],
  'stockton':        ['Downtown Stockton','Victory Park','Lincoln Village','Brookside','Weston Ranch','Marble Acres','University District'],
  'chula-vista':     ['Downtown Chula Vista','Eastlake','Otay Ranch','Bonita','Rolling Hills Ranch','Sunbow','McMillin'],
  'fremont':         ['Downtown Fremont','Warm Springs','Centerville','Mission San Jose','Irvington','Ardenwood','Niles'],
  'san-bernardino':  ['Downtown San Bernardino','Verdemont','Arrowhead Farms','Muscoy','Westside','Northeast San Bernardino'],
  'modesto':         ['Downtown Modesto','Sylvan','Beyer Park','Crows Landing','Village One','Salida'],
  'oxnard':          ['Downtown Oxnard','Colonia','Southwinds','Riverpark','Silver Strand','Hollywood Beach','Channel Islands'],
  'fontana':         ['Downtown Fontana','North Fontana','Southridge','Sierra Lakes','Jurupa Hills'],
  'moreno-valley':   ['Downtown Moreno Valley','Sunnymead Ranch','March Business Center','Lasselle Corridor'],
  'glendale':        ['Downtown Glendale','Montrose','La Crescenta','Adams Hill','Chevy Chase','Verdugo Woodlands'],
  'huntington-beach':['Downtown HB','Surf City','Southeast HB','Huntington Harbour','Holly-Seacliff','Bolsa Chica'],
  'santa-ana':       ['Downtown Santa Ana','Floral Park','Lacy','Logan','Midtown','Riverview','French Park'],
  'garden-grove':    ['Downtown Garden Grove','West Garden Grove','Eastside','Garden Park'],
  'oceanside':       ['Downtown Oceanside','South Oceanside','Fire Mountain','Morro Hills','Mission','Northeast Oceanside'],
  'petaluma':        ['Downtown Petaluma','East Petaluma','West Petaluma','Petaluma Village','South Petaluma'],
  'rohnert-park':    ['Southeast Rohnert Park','Northeast Rohnert Park','Northwest Rohnert Park','Southwest Rohnert Park','Sonoma State Area'],
  'santa-barbara':   ['Downtown Santa Barbara','Funk Zone','Eastside','Westside','Mesa','Mission Canyon','Montecito','Hope Ranch','Riviera'],
  'pasadena':        ['Downtown Pasadena','Old Pasadena','South Lake','Bungalow Heaven','Hastings Ranch','San Rafael','Linda Vista','Caltech-Huntington'],
  'torrance':        ['Downtown Torrance','Old Torrance','Hollywood Riviera','Southwood','North Torrance','West Torrance'],
  'pomona':          ['Downtown Pomona','Lincoln Park','Village Green','Ganesha Hills','South Pomona','East Pomona'],
  'escondido':       ['Downtown Escondido','South Escondido','North Escondido','Felicita','Hidden Valley','Rincon'],
  'sunnyvale':       ['Downtown Sunnyvale','Murphy Avenue','Lakewood','Ponderosa','Cherry Chase','Columbia'],
  'santa-clara':     ['Downtown Santa Clara','Agnew','Warburton','Rivermark','Mission','Lawrence Expressway Corridor'],
  'hayward':         ['Downtown Hayward','South Hayward','Tennyson-Alquire','Harder-Tennyson','A Street','Longwood-Winton'],
  'salinas':         ['Downtown Salinas','Alisal','East Salinas','North Salinas','Las Lomas','Toro Park'],
  'corona':          ['Downtown Corona','South Corona','Eastvale adjacent','Sierra Del Oro','Chase Ranch','Norco Hills'],
  'palmdale':        ['Downtown Palmdale','North Palmdale','Quartz Hill','West Palmdale','Sun Village','Desert Aire'],
  'lancaster':       ['Downtown Lancaster','East Lancaster','Quartz Hill','West Lancaster','Sun Village'],
  'elk-grove':       ['Downtown Elk Grove','Laguna','Sheldon','South Elk Grove','Lakeside'],
  'vallejo':         ['Downtown Vallejo','Glen Cove','Hiddenbrooke','Northgate','Starling','South Vallejo'],
  'concord':         ['Downtown Concord','Sun Valley','Holbrook Heights','Monument Corridor','Crossroads','Clyde'],
  'thousand-oaks':   ['Downtown Thousand Oaks','Lynn Ranch','Newbury Park','Lang Ranch','Wildwood'],
  'simi-valley':     ['Downtown Simi Valley','Big Sky','Wood Ranch','Bridle Path','Simi Valley Hills'],
  'visalia':         ['Downtown Visalia','Riverway','Northwest Visalia','Mooney','Mt Whitney'],
  'ventura':         ['Downtown Ventura','Midtown','Westside','East Ventura','Pierpont','El Rio'],
  'murrieta':        ['Downtown Murrieta','French Valley','Greer Ranch','Copper Canyon','La Cresta','Murrieta Hot Springs'],
  'temecula':        ['Old Town Temecula','Wine Country','Redhawk','Vail Ranch','Harveston','South Temecula'],
  'richmond':        ['Downtown Richmond','Point Richmond','Iron Triangle','North Richmond','Hilltop','Marina Bay','El Sobrante'],
  'antioch':         ['Downtown Antioch','Prewett','Lone Tree','East Antioch','Sand Creek'],
  'west-covina':     ['Downtown West Covina','Cortez','West Covina Hills','Merced','Shadow Oak'],
  'norwalk':         ['Downtown Norwalk','Norwalk Square','East Norwalk','West Norwalk'],
  'burbank':         ['Downtown Burbank','Magnolia Park','Media District','Rancho','Chandler Park'],
  'el-monte':        ['Downtown El Monte','South El Monte','North El Monte','Garvey'],
  'downey':          ['Downtown Downey','North Downey','South Downey','East Downey'],
  'costa-mesa':      ['Downtown Costa Mesa','Eastside','Mesa Verde','Westside','Harbor'],
  'inglewood':       ['Downtown Inglewood','Morningside Park','Fairview Heights','Century','Hyde Park adjacent'],
  'carlsbad':        ['Downtown Carlsbad','Aviara','La Costa','Bressi Ranch','Calavera Hills','Terramar'],
  'el-cajon':        ['Downtown El Cajon','Fletcher Hills','Rancho San Diego','Bostonia','Winter Gardens'],
  'vista':           ['Downtown Vista','Shadowridge','Buena Creek','South Vista','Rancho Minerva'],
  'fullerton':       ['Downtown Fullerton','Sunny Hills','Coyote Hills','East Fullerton','West Fullerton','Craig Regional'],
  'orange':          ['Downtown Orange','Old Towne Orange','Chapman Hills','Serrano Heights','Olive Hills','East Orange'],
  'santa-monica':    ['Downtown Santa Monica','Ocean Park','Wilshire Montana','North of Montana','Mid-City','Sunset Park','Pico Neighborhood'],
  'hawthorne':       ['Downtown Hawthorne','Hollyglen','Ramona','South Hawthorne'],
  'compton':         ['Downtown Compton','East Compton','North Compton','West Compton'],
  'whittier':        ['Downtown Whittier','Uptown','East Whittier','South Whittier','Friendly Hills'],
  'alhambra':        ['Downtown Alhambra','Midwick','Almansor','Granada','North Alhambra'],
  'mission-viejo':   ['Downtown Mission Viejo','Painted Trails','Casta del Sol','Deane Homes','The Shops'],
  'napa':            ['Downtown Napa','Browns Valley','Silverado Highlands','Alta Heights','Coombsville','Carneros'],
  'hemet':           ['Downtown Hemet','East Hemet','Valle Vista','Winchester','Kirby Estates'],
  'clovis':          ['Downtown Clovis','Old Town Clovis','Harlan Ranch','Loma Vista','Copper River'],
  'newport-beach':   ['Balboa Island','Balboa Peninsula','Corona del Mar','Newport Heights','Fashion Island','West Newport','Lido Isle'],
  'chico':           ['Downtown Chico','Barber','Chapman','South Campus','Avocado Orchard','Hooker Oak'],
  'vacaville':       ['Downtown Vacaville','Elmira','Browns Valley','Nut Tree','Alamo Drive'],
  'roseville':       ['Downtown Roseville','West Roseville','Galleria','Fiddyment Farm','Sun City Roseville','Sierra Vista'],
  'folsom':          ['Downtown Folsom','Willow Creek','Broadstone','Briggs Ranch','Empire Ranch','Oak Hill'],
  'redding':         ['Downtown Redding','Shasta Lake','Cascade','Buckeye','Canby Park'],
  'hesperia':        ['Downtown Hesperia','Oak Hills','Ranchero','Sultana','Arrowhead Farms adjacent'],
  'victorville':     ['Downtown Victorville','Spring Valley Lake','Baldy Mesa','Pebble Beach','Hook Boulevard']
};

const ZIPCODES_BY_CITY = {
  'los-angeles':      ['90001','90002','90003','90004','90005','90006','90007','90008','90010','90011','90012','90013','90014','90015','90016','90017','90018','90019','90020','90021','90022','90023','90024','90025','90026','90027','90028','90029','90031','90032','90033','90034','90035','90036','90037','90038','90039','90041','90042','90043','90044','90045','90046','90047','90048','90049','90056','90057','90058','90059','90061','90062','90063','90064','90065','90066','90067','90068','90071','90077','90210','90211','90212','90230','90232','90247','90248','90272','90290','90291','90292','90293'],
  'san-francisco':    ['94102','94103','94104','94105','94107','94108','94109','94110','94111','94112','94114','94115','94116','94117','94118','94121','94122','94123','94124','94127','94129','94130','94131','94132','94133','94134','94158'],
  'san-diego':        ['92101','92102','92103','92104','92105','92106','92107','92108','92109','92110','92111','92113','92114','92115','92116','92117','92119','92120','92121','92122','92123','92124','92126','92127','92128','92129','92130','92131','92139','92154'],
  'san-jose':         ['95101','95110','95111','95112','95113','95116','95117','95118','95119','95120','95121','95122','95123','95124','95125','95126','95127','95128','95129','95130','95131','95132','95133','95134','95135','95136','95138','95139','95148'],
  'irvine':           ['92602','92603','92604','92606','92612','92614','92617','92618','92620'],
  'oakland':          ['94601','94602','94603','94605','94606','94607','94608','94609','94610','94611','94612','94618','94619','94621'],
  'long-beach':       ['90802','90803','90804','90805','90806','90807','90808','90810','90813','90814','90815'],
  'fresno':           ['93701','93702','93703','93704','93705','93706','93710','93711','93720','93721','93722','93725','93726','93727','93728','93730'],
  'sacramento':       ['95811','95814','95815','95816','95817','95818','95819','95820','95821','95822','95823','95824','95825','95826','95827','95828','95829','95831','95832','95833','95834','95835','95838'],
  'anaheim':          ['92801','92802','92804','92805','92806','92807','92808'],
  'santa-ana':        ['92701','92703','92704','92705','92706','92707'],
  'riverside':        ['92501','92503','92504','92505','92506','92507','92508'],
  'bakersfield':      ['93301','93304','93305','93306','93307','93308','93309','93311','93312','93313'],
  'stockton':         ['95201','95202','95203','95204','95205','95206','95207','95209','95210','95212'],
  'chula-vista':      ['91910','91911','91913','91914','91915'],
  'fremont':          ['94536','94537','94538','94539','94555'],
  'san-bernardino':   ['92401','92404','92405','92407','92408','92410','92411'],
  'modesto':          ['95350','95351','95354','95355','95356','95357','95358'],
  'oxnard':           ['93030','93033','93035','93036'],
  'fontana':          ['92335','92336','92337'],
  'moreno-valley':    ['92551','92553','92555','92557'],
  'glendale':         ['91201','91202','91203','91204','91205','91206','91207','91208'],
  'huntington-beach': ['92646','92647','92648','92649'],
  'santa-barbara':    ['93101','93103','93105','93106','93108','93109','93110','93111'],
  'pasadena':         ['91101','91103','91104','91105','91106','91107'],
  'torrance':         ['90501','90502','90503','90504','90505','90506','90507','90508','90509'],
  'orange':           ['92856','92857','92859','92861','92862','92863','92864','92865','92866','92867','92868','92869'],
  'fullerton':        ['92831','92832','92833','92834','92835','92836','92837','92838'],
  'escondido':        ['92025','92026','92027','92029'],
  'sunnyvale':        ['94085','94086','94087','94088','94089'],
  'santa-clara':      ['95050','95051','95052','95053','95054','95055','95056'],
  'hayward':          ['94540','94541','94542','94543','94544','94545'],
  'salinas':          ['93901','93905','93906','93907','93908','93912'],
  'corona':           ['92879','92880','92881','92882','92883'],
  'palmdale':         ['93550','93551','93552','93553','93590'],
  'lancaster':        ['93534','93535','93536'],
  'elk-grove':        ['95624','95757','95758','95759'],
  'vallejo':          ['94589','94590','94591','94592'],
  'concord':          ['94518','94519','94520','94521','94522','94524'],
  'thousand-oaks':    ['91320','91358','91360','91361','91362'],
  'simi-valley':      ['93063','93065'],
  'visalia':          ['93277','93278','93279','93290','93291','93292'],
  'ventura':          ['93001','93003','93004','93009'],
  'murrieta':         ['92562','92563','92564'],
  'temecula':         ['92589','92590','92591','92592','92593'],
  'richmond':         ['94801','94802','94803','94804','94805','94806'],
  'antioch':          ['94509','94531'],
  'costa-mesa':       ['92626','92627','92628','92629'],
  'inglewood':        ['90301','90302','90303','90304','90305'],
  'carlsbad':         ['92008','92009','92010','92011','92013'],
  'el-cajon':         ['92019','92020','92021','92022'],
  'santa-monica':     ['90401','90402','90403','90404','90405'],
  'burbank':          ['91501','91502','91503','91504','91505','91506'],
  'napa':             ['94558','94559'],
  'chico':            ['95926','95927','95928','95929'],
  'vacaville':        ['95687','95688','95696'],
  'roseville':        ['95661','95678','95747'],
  'folsom':           ['95630'],
  'redding':          ['96001','96002','96003'],
  'petaluma':         ['94952','94953','94954','94955'],
  'rohnert-park':     ['94927','94928'],
  'santa-rosa':       ['95401','95402','95403','95404','95405','95406','95407','95408','95409'],
  'healdsburg':       ['95448'],
  'sonoma':           ['95476'],
  'san-rafael':       ['94901','94903','94912','94913','94914','94915'],
  'novato':           ['94945','94947','94948','94949'],
  'fairfield':        ['94533','94534','94535'],
  'benicia':          ['94510'],
  'hesperia':         ['92340','92344','92345'],
  'victorville':      ['92392','92393','92394','92395'],
  'palm-springs':     ['92262','92263','92264'],
  'palm-desert':      ['92210','92211','92255','92260','92261'],
  'indio':            ['92201','92202','92203'],
  'lake-elsinore':    ['92530','92531','92532'],
  'perris':           ['92570','92571','92572'],
  'menifee':          ['92584','92585','92586','92587'],
  'san-clemente':     ['92672','92673','92674'],
  'laguna-beach':     ['92651','92652'],
  'dana-point':       ['92629'],
  'mission-viejo':    ['92691','92692'],
  'lake-forest':      ['92610','92630'],
  'aliso-viejo':      ['92656'],
  'san-juan-capistrano':['92675'],
  'yorba-linda':      ['92886','92887'],
  'brea':             ['92821','92822','92823'],
  'placentia':        ['92870'],
  'la-habra':         ['90631','90632','90633'],
  'buena-park':       ['90620','90621','90622','90623','90624'],
  'garden-grove':     ['92840','92841','92842','92843','92844','92845','92846'],
  'westminster':      ['92683','92684','92685'],
  'fountain-valley':  ['92708','92728'],
  'cypress':          ['90630'],
  'seal-beach':       ['90740'],
  'los-alamitos':     ['90720','90721'],
  'stanton':          ['90680'],
  'la-palma':         ['90623'],
  'rancho-santa-margarita':['92688'],
  'poway':            ['92064','92074'],
  'national-city':    ['91950','91951'],
  'la-mesa':          ['91941','91942','91943','91944','91945'],
  'coronado':         ['92118'],
  'imperial-beach':   ['91932'],
  'del-mar':          ['92014'],
  'solana-beach':     ['92075'],
  'encinitas':        ['92023','92024'],
  'santee':           ['92071'],
  'oceanside':        ['92049','92051','92052','92054','92056','92057','92058'],
  'vista':            ['92081','92083','92084','92085'],
  'san-marcos':       ['92069','92078','92079','92096'],
  'san-luis-obispo':  ['93401','93402','93403','93405','93406','93407','93408','93409','93410'],
  'paso-robles':      ['93446','93447'],
  'santa-maria':      ['93454','93455','93456','93457','93458'],
  'lompoc':           ['93436','93437','93438'],
  'goleta':           ['93116','93117','93118'],
  'south-lake-tahoe': ['96150','96151','96152','96153','96154','96155'],
  'mammoth-lakes':    ['93546'],
  'bishop':           ['93514','93515'],
  'monterey':         ['93940','93942','93943','93944'],
  'pacific-grove':    ['93950','93951'],
  'carmel-by-the-sea':['92921','92922','92923','92924'],
  'king-city':        ['93930'],
  'hollister':        ['95023','95024'],
  'watsonville':      ['95076','95077'],
  'santa-cruz':       ['95060','95061','95062','95063','95064','95065','95066','95067'],
  'capitola':         ['95010'],
  'scotts-valley':    ['95066'],
  'gilroy':           ['95020','95021'],
  'morgan-hill':      ['95037','95038'],
  'los-gatos':        ['95030','95031','95032','95033'],
  'campbell':         ['95008','95009'],
  'saratoga':         ['95070','95071'],
  'cupertino':        ['95014','95015'],
  'mountain-view':    ['94039','94040','94041','94042','94043'],
  'palo-alto':        ['94301','94302','94303','94304','94305','94306','94309'],
  'milpitas':         ['95035','95036'],
  'menlo-park':       ['94025','94026','94027'],
  'redwood-city':     ['94061','94062','94063','94064','94065'],
  'san-mateo':        ['94401','94402','94403','94404'],
  'burlingame':       ['94010','94011'],
  'daly-city':        ['94014','94015','94016','94017'],
  'south-san-francisco':['94080','94083'],
  'san-bruno':        ['94066'],
  'millbrae':         ['94030'],
  'foster-city':      ['94404'],
  'belmont':          ['94002'],
  'san-carlos':       ['94070'],
  'half-moon-bay':    ['94019'],
  'pacifica':         ['94044'],
  'livermore':        ['94550','94551'],
  'pleasanton':       ['94566','94567','94568','94588'],
  'dublin':           ['94568'],
  'union-city':       ['94587'],
  'newark':           ['94560'],
  'san-leandro':      ['94577','94578','94579'],
  'walnut-creek':     ['94595','94596','94597','94598'],
  'pleasant-hill':    ['94523'],
  'martinez':         ['94553'],
  'el-cerrito':       ['94530'],
  'hercules':         ['94547'],
  'lafayette':        ['94549'],
  'orinda':           ['94563'],
  'moraga':           ['94556'],
  'danville':         ['94506','94507'],
  'pittsburg':        ['94565'],
  'brentwood':        ['94513'],
  'oakley':           ['94561'],
  'san-ramon':        ['94582','94583'],
  'dixon':            ['95620'],
  'suisun-city':      ['94585'],
  'rio-vista':        ['94571'],
  'tracy':            ['95376','95377','95378'],
  'manteca':          ['95336','95337'],
  'lodi':             ['95240','95241','95242'],
  'ceres':            ['95307'],
  'turlock':          ['95380','95381','95382'],
  'merced':           ['95340','95341','95343','95344'],
  'atwater':          ['95301'],
  'los-banos':        ['93635'],
  'madera':           ['93637','93638','93639'],
  'clovis':           ['93611','93612','93613'],
  'sanger':           ['93657'],
  'selma':            ['93662'],
  'porterville':      ['93257','93258','93259','93260'],
  'tulare':           ['93274','93275'],
  'hanford':          ['93230','93232'],
  'lemoore':          ['93245'],
  'delano':           ['93215','93216'],
  'ridgecrest':       ['93555','93556'],
  'tehachapi':        ['93561','93562'],
  'wasco':            ['93280'],
  'marysville':       ['95901'],
  'yuba-city':        ['95991','95992','95993'],
  'oroville':         ['95965','95966'],
  'red-bluff':        ['96080'],
  'corning':          ['96021'],
  'willows':          ['95988'],
  'ukiah':            ['95482'],
  'fort-bragg':       ['95437'],
  'willits':          ['95490'],
  'lakeport':         ['95453'],
  'clearlake':        ['95422','95423'],
  'eureka':           ['95501','95502','95503'],
  'arcata':           ['95521'],
  'fortuna':          ['95540'],
  'crescent-city':    ['95531','95532'],
  'yreka':            ['96097'],
  'mount-shasta':     ['96067'],
  'weed':             ['96094'],
  'alturas':          ['96101'],
  'susanville':       ['96130'],
  'quincy':           ['95971'],
  'portola':          ['96122'],
  'nevada-city':      ['95959'],
  'grass-valley':     ['95945','95949'],
  'truckee':          ['96160','96161','96162'],
  'auburn':           ['95602','95603','95604'],
  'lincoln':          ['95648'],
  'rocklin':          ['95677','95765'],
  'placerville':      ['95667'],
  'el-dorado-hills':  ['95762'],
  'jackson':          ['95642'],
  'angels-camp':      ['95222'],
  'sonora':           ['95370'],
  'markleeville':     ['96120'],
  'bridgeport':       ['93517'],
  'lone-pine':        ['93545'],
  'el-centro':        ['92243','92244'],
  'calexico':         ['92231','92232'],
  'brawley':          ['92227'],
  'imperial':         ['92251'],
  'hollister':        ['95023','95024'],
  'san-juan-bautista':['95045']
};

// ── Helper functions ───────────────────────────────────────────────────────

function getCounties() {
  return CALIFORNIA_COUNTIES;
}

function getCities(countyId) {
  const cities = CITIES_BY_COUNTY[countyId] || [];
  return cities.map(name => ({
    id: toKey(name),
    name,
    countyId,
    state: 'CA'
  }));
}

function getNeighborhoods(cityId) {
  const neighborhoods = NEIGHBORHOODS_BY_CITY[cityId] || [];
  return neighborhoods.map(name => ({
    id: toKey(name),
    name,
    cityId,
    state: 'CA',
    source: 'local'
  }));
}

function getZipcodes(cityId) {
  const zips = ZIPCODES_BY_CITY[cityId] || [];
  return zips.map(zip => ({
    zip,
    cityId,
    state: 'CA',
    source: 'local'
  }));
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, countyId, cityId, cityName } = req.query;

    // ── COUNTIES ─────────────────────────────────────────────────────────
    if (type === 'counties') {
      const counties = getCounties();
      return res.status(200).json({ success: true, data: counties, source: 'local', count: counties.length });
    }

    // ── CITIES BY COUNTY ─────────────────────────────────────────────────
    if (type === 'cities') {
      if (!countyId) return res.status(400).json({ success: false, error: 'countyId is required', data: [] });
      const cities = getCities(countyId);
      return res.status(200).json({ success: true, data: cities, source: 'local', count: cities.length });
    }

    // ── NEIGHBORHOODS BY CITY ─────────────────────────────────────────────
    if (type === 'neighborhoods') {
      if (!cityId && !cityName) return res.status(400).json({ success: false, error: 'cityId or cityName is required', data: [] });
      const key = cityId || toKey(cityName);
      const local = getNeighborhoods(key);

      if (local.length > 0) {
        return res.status(200).json({ success: true, data: local, source: 'local', count: local.length });
      }

      // Nominatim fallback for cities not in embedded data
      try {
        const searchName = cityName || (cityId || '').replace(/-/g, ' ');
        const url = `https://nominatim.openstreetmap.org/search?country=USA&state=California&city=${encodeURIComponent(searchName)}&format=json&addressdetails=1&limit=50`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'LeadGen-AI-Tool/1.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (resp.ok) {
          const results = await resp.json();
          const seen = new Set();
          const data = [];
          for (const item of results) {
            const addr = item.address || {};
            for (const field of ['suburb', 'neighbourhood', 'quarter']) {
              const n = addr[field];
              if (n && !seen.has(n)) { seen.add(n); data.push({ id: toKey(n), name: n, cityId: key, source: 'nominatim' }); }
            }
          }
          if (data.length > 0) return res.status(200).json({ success: true, data, source: 'nominatim', count: data.length });
        }
      } catch (e) {
        console.error('Nominatim fallback error:', e.message);
      }

      return res.status(200).json({ success: true, data: [], source: 'none', count: 0 });
    }

    // ── ZIP CODES BY CITY ─────────────────────────────────────────────────
    if (type === 'zipcodes') {
      if (!cityId && !cityName) return res.status(400).json({ success: false, error: 'cityId or cityName is required', data: [] });
      const key = cityId || toKey(cityName);
      const local = getZipcodes(key);

      if (local.length > 0) {
        return res.status(200).json({ success: true, data: local, source: 'local', count: local.length });
      }

      // Zippopotam.us fallback for cities not in embedded data
      try {
        const searchName = (cityName || (cityId || '').replace(/-/g, ' ')).toLowerCase();
        const resp = await fetch(`https://api.zippopotam.us/us/ca/${encodeURIComponent(searchName)}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (resp.ok) {
          const zipData = await resp.json();
          const places = zipData.places || [];
          if (places.length > 0) {
            const data = places.map(p => ({ zip: p['post code'], cityId: key, source: 'zippopotam' }));
            return res.status(200).json({ success: true, data, source: 'zippopotam', count: data.length });
          }
        }
      } catch (e) {
        console.error('Zippopotam fallback error:', e.message);
      }

      return res.status(200).json({ success: true, data: [], source: 'none', count: 0 });
    }

    return res.status(400).json({ success: false, error: 'Invalid type. Use: counties | cities | neighborhoods | zipcodes', data: [] });

  } catch (err) {
    console.error('locations.js error:', err);
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
}
