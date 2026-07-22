import { normCounty } from './_tx-county-population.js';

// TX appraisal-district filing registry — ALL 254 Texas counties.
//
// The property DATA (account #, values, sqft) comes from the live engine
// (/api/evidence-pack/lookup). This file holds the per-county FILING metadata
// the engine doesn't carry: the official appraisal-district name that prints on
// Form 50-132, plus where the homeowner files it.
//
// Two sources, merged 2026-07-21:
//   1. The Texas Comptroller's county appraisal-district directory — website,
//      mailing address and phone for every one of the 254 counties.
//   2. The TaxDrop verified registry — the 65 districts whose official legal
//      name and online protest portal we confirmed against the district's own
//      site (names verified 2026-06-24, portals liveness-checked 2026-07-04).
//
// NULL-NAME POLICY: `cadName` is null for the 189 counties the Comptroller
// directory does not name. An appraisal district's legal name is not derivable
// — Bell is "Tax Appraisal District of Bell County", Johnson is "Central
// Appraisal District of Johnson County", and Cameron/Tarrant/Wichita/Comal/
// Ellis carry no "County" at all. An earlier scrape guessed names by pattern
// and was wrong often enough that the guesses were stripped. NEVER invent one:
// a wrong district name on a filed Form 50-132 is a real defect. Callers render
// "your appraisal district" instead. These counties are still fully serviceable
// — the address, website and phone are real, so coverage stays 'county'.
//
// Re-verify annually before the May filing season (counties occasionally rename
// — Brazoria became "Brazoria Central Appraisal District" on 2026-01-01).
//
// County keys are the engine subject.county slug form: lowercase, alphanumerics
// only, NO spaces (e.g. "fortbend", "elpaso") — matched via normCounty().
//
// efileUrl = the district's online protest portal, present only where we
// confirmed one live against the district's own domain. Some CAD portals go
// offline outside protest season — re-verify before May. Counties left
// website-only either have no online filing or their portal couldn't be
// confirmed (candidates pending manual check: bastrop, fannin, limestone,
// vanzandt — eprotest.<cad> subdomains found but unreachable).

export interface TxCad {
  /** Official district name, or null when we have not verified it. Never guess. */
  cadName: string | null;
  /** Where the homeowner files the signed protest (instruction text). */
  fileBy: {
    efileUrl?: string;   // online protest portal, when the district offers one
    /**
     * One-line "what to do when you land there", for districts whose efileUrl
     * isn't a direct file-your-protest page (e.g. Dallas drops you on a property
     * search and the uFile link only appears on the account detail screen).
     */
    efileNote?: string;
    efileGuideUrl?: string; // official walkthrough (PDF/video), where one exists
    website?: string;    // official district website
    mailTo?: string;     // district mailing address
    phone?: string;      // district phone
    /**
     * Bespoke "how to VIEW the district's evidence" text (distinct from the
     * filing fields above). Optional — populate only where the mechanics are
     * county-specific enough to be worth spelling out (account-number format,
     * where the PIN comes from, the exact evidence portal). When absent, the UI
     * renders its per-state statutory default. Every TX owner is entitled to the
     * evidence at least 14 days before the hearing (Tax Code §41.461).
     */
    evidenceHowTo?: string;
  };
}

export const TX_CADS: Record<string, TxCad> = {
  // Anderson County
  anderson: {
    cadName: 'Anderson County Appraisal District',
    fileBy: { website: 'https://www.andersoncad.net', mailTo: 'P.O. Box 279, Palestine, TX 75802-0279', phone: '903-723-2949' },
  },
  // Andrews County
  andrews: {
    cadName: null,
    fileBy: { website: 'https://www.andrewscad.org', mailTo: '600 N. Main St., Andrews, TX 79714-5207', phone: '432-523-9111' },
  },
  // Angelina County
  angelina: {
    cadName: null,
    fileBy: { website: 'https://www.angelinacad.org', mailTo: 'P.O. Box 2357, Lufkin, TX 75902-2357', phone: '936-634-8456' },
  },
  // Aransas County
  aransas: {
    cadName: 'Aransas County Appraisal District',
    fileBy: { efileUrl: 'https://portal.aransascad.org/', website: 'https://aransascad.org', mailTo: '11 Hwy 35 N, Rockport, TX 78382-4140', phone: '361-729-9733' },
  },
  // Archer County
  archer: {
    cadName: null,
    fileBy: { website: 'https://www.archercad.org', mailTo: 'P.O. Box 1141, Archer City, TX 76351-1141', phone: '940-574-2172' },
  },
  // Armstrong County
  armstrong: {
    cadName: null,
    fileBy: { website: 'https://armstrongcad.org', mailTo: 'P.O. Box 149, Claude, TX 79019-0149', phone: '806-331-9479' },
  },
  // Atascosa County
  atascosa: {
    cadName: null,
    fileBy: { website: 'https://www.atascosacad.com', mailTo: 'P.O. Box 600, Pleasanton, TX 78064', phone: '830-569-8326' },
  },
  // Austin County
  austin: {
    cadName: 'Austin County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.austincad.org/', website: 'https://austincad.org', mailTo: '906 E. Amelia St., Bellville, TX 77418-2843', phone: '979-865-9124' },
  },
  // Bailey County
  bailey: {
    cadName: null,
    fileBy: { website: 'https://www.bailey-cad.org', mailTo: '302 Main St., Muleshoe, TX 79347-3852', phone: '806-272-5501' },
  },
  // Bandera County
  bandera: {
    cadName: null,
    fileBy: { website: 'https://www.bancad.org', mailTo: 'P.O. Box 1119, Bandera, TX 78003-1119', phone: '830-796-3039' },
  },
  // Bastrop County
  bastrop: {
    cadName: 'Bastrop Central Appraisal District',
    fileBy: { website: 'https://bastropcad.org', mailTo: 'P.O. Box 578, Bastrop, TX 78602-0578', phone: '512-303-1930' },
  },
  // Baylor County
  baylor: {
    cadName: null,
    fileBy: { website: 'https://www.baylorcad.org', mailTo: '211 N. Washington St., Seymour, TX 76380-2123', phone: '940-888-5636' },
  },
  // Bee County
  bee: {
    cadName: null,
    fileBy: { website: 'https://www.beecad.org', mailTo: '401 N. Washington St., Beeville, TX 78102-3911', phone: '361-358-0193' },
  },
  // Bell County
  bell: {
    cadName: 'Tax Appraisal District of Bell County',
    fileBy: { efileUrl: 'https://portal.bellcad.org/', website: 'https://bellcad.org', mailTo: 'P.O. Box 390, Belton, TX 76513-0390', phone: '254-939-5841' },
  },
  // Bexar County
  bexar: {
    cadName: 'Bexar Central Appraisal District',
    fileBy: {
      // Was a help-center article; the real owner portal is bcad.org/online-portal
      // (login host bcadonline.org). Verified 2026-07-22 against bcad.org.
      efileUrl: 'https://bcad.org/online-portal/',
      website: 'https://bcad.org',
      mailTo: 'P.O. Box 830248, San Antonio, TX 78283-0248',
      phone: '210-242-2432',
      evidenceHowTo: 'To see the evidence Bexar Central Appraisal District (BCAD) used to value your property, log into the [BCAD online portal](https://bcad.org/online-portal/) using the Owner/Agent ID and PIN from the top of your Notice of Appraised Value (the PIN is case-sensitive). After you file, open the Protest Summary page and click the Evidence View tab. The district must make its evidence available to you at least 14 days before your hearing (Texas Tax Code §41.461).',
    },
  },
  // Blanco County
  blanco: {
    cadName: null,
    fileBy: { website: 'https://www.blancocad.com', mailTo: 'P.O. Box 338, Johnson City, TX 78636-0338', phone: '830-868-4013' },
  },
  // Borden County
  borden: {
    cadName: null,
    fileBy: { website: 'https://www.bordencad.org', mailTo: 'P.O. Box 298, Gail, TX 79738-0298', phone: '806-756-4484' },
  },
  // Bosque County
  bosque: {
    cadName: 'Bosque County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.bosquecad.com/', website: 'https://bosquecad.com', mailTo: 'P.O. Box 393, Meridian, TX 76665-0393', phone: '254-435-2304' },
  },
  // Bowie County
  bowie: {
    cadName: null,
    fileBy: { website: 'https://www.bowieappraisal.com', mailTo: 'P.O. Box 6527, Texarkana, TX 75505-6527', phone: '903-793-8936' },
  },
  // Brazoria County
  brazoria: {
    cadName: 'Brazoria Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.brazoriacad.org/', website: 'https://brazoriacad.org', mailTo: '500 N. Chenango St., Angleton, TX 77515-4650', phone: '979-849-7792' },
  },
  // Brazos County
  brazos: {
    cadName: 'Brazos Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.brazoscad.org/', website: 'https://brazoscad.org', mailTo: '4051 Pendleton Dr., Bryan, TX 77802', phone: '979-774-4100' },
  },
  // Brewster County
  brewster: {
    cadName: null,
    fileBy: { website: 'https://www.brewstercotad.org', mailTo: '1604 W. Hwy. 90, Alpine, TX 79830-4315', phone: '432-837-2558' },
  },
  // Briscoe County
  briscoe: {
    cadName: null,
    fileBy: { website: 'https://www.briscoecad.org', mailTo: 'P.O. Box 728, Silverton, TX 79257-0728', phone: '806-823-2161' },
  },
  // Brooks County
  brooks: {
    cadName: null,
    fileBy: { website: 'https://www.brookscad.org', mailTo: 'P.O. Drawer A, Falfurrias, TX 78355-5500', phone: '361-325-8120' },
  },
  // Brown County
  brown: {
    cadName: null,
    fileBy: { website: 'https://www.brown-cad.org', mailTo: '3804 Hwy. 377 S, Brownwood, TX 76801-5120', phone: '325-643-5676' },
  },
  // Burleson County
  burleson: {
    cadName: 'Burleson County Appraisal District',
    fileBy: { efileUrl: 'https://portal.burlesonappraisal.com/', website: 'https://burlesonappraisal.com', mailTo: 'P.O. Box 1000, Caldwell, TX 77836-1000', phone: '979-567-2318' },
  },
  // Burnet County
  burnet: {
    cadName: 'Burnet Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.burnet-cad.org/', website: 'https://burnet-cad.org', mailTo: 'P.O. Box 908, Burnet, TX 78611-0908', phone: '512-756-8291' },
  },
  // Caldwell County
  caldwell: {
    cadName: 'Caldwell County Appraisal District',
    fileBy: { efileUrl: 'https://caldwellcad.org/online-e-file-appeals/', website: 'https://caldwellcad.org', mailTo: 'P.O. Box 900, Lockhart, TX 78644-0900', phone: '512-398-5550' },
  },
  // Calhoun County
  calhoun: {
    cadName: null,
    fileBy: { website: 'https://www.calhouncad.org', mailTo: 'P.O. Box 49, Port Lavaca, TX 77979-0049', phone: '361-552-8808' },
  },
  // Callahan County
  callahan: {
    cadName: null,
    fileBy: { website: 'https://www.callahancad.org', mailTo: '302 Chestnut St., Baird, TX 79504', phone: '325-854-2528' },
  },
  // Cameron County
  cameron: {
    cadName: 'Cameron Appraisal District',
    fileBy: { website: 'https://www.cameroncad.org', mailTo: 'P.O. Box 1010, San Benito, TX 78586-1010', phone: '956-399-9322' },
  },
  // Camp County
  camp: {
    cadName: null,
    fileBy: { website: 'https://www.campcad.org', mailTo: '143 Quitman St., Pittsburg, TX 75686-1361', phone: '903-856-6538' },
  },
  // Carson County
  carson: {
    cadName: null,
    fileBy: { website: 'https://www.carsoncad.org', mailTo: 'P.O. Box 970, Panhandle, TX 79068-0970', phone: '806-537-3569' },
  },
  // Cass County
  cass: {
    cadName: 'Cass County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.casscad.org/', website: 'https://casscad.org', mailTo: '502 N. Main St., Linden, TX 75563-5218', phone: '903-756-7545' },
  },
  // Castro County
  castro: {
    cadName: null,
    fileBy: { website: 'https://castrocad.org', mailTo: '204 S.E. 3rd St. (Rear), Dimmitt, TX 79027-2612', phone: '806-647-5131' },
  },
  // Chambers County
  chambers: {
    cadName: null,
    fileBy: { website: 'https://www.chamberscad.org', mailTo: 'P.O. Box 1520, Anahuac, TX 77514-1520', phone: '409-267-3795' },
  },
  // Cherokee County
  cherokee: {
    cadName: null,
    fileBy: { website: 'https://www.cherokeecad.com', mailTo: 'P.O. Box 494, Rusk, TX 75785-0494', phone: '903-683-2296' },
  },
  // Childress County
  childress: {
    cadName: null,
    fileBy: { website: 'https://www.childresscad.org', mailTo: '1710 Avenue F N.W., Childress, TX 79201-3756', phone: '940-937-6062' },
  },
  // Clay County
  clay: {
    cadName: null,
    fileBy: { website: 'https://www.claycad.org', mailTo: 'P.O. Box 108, Henrietta, TX 76365-0108', phone: '940-538-4311' },
  },
  // Cochran County
  cochran: {
    cadName: null,
    fileBy: { website: 'https://www.cochrancad.com', mailTo: '109 S.E. First St., Morton, TX 79346-3101', phone: '806-266-5584' },
  },
  // Coke County
  coke: {
    cadName: null,
    fileBy: { website: 'https://www.cokecad.org', mailTo: 'P.O. Box 2, Robert Lee, TX 76945-0002', phone: '325-453-4528' },
  },
  // Coleman County
  coleman: {
    cadName: null,
    fileBy: { website: 'https://www.colemancad.net', mailTo: 'P.O. Box 914, Coleman, TX 76834-0914', phone: '325-625-4155' },
  },
  // Collin County
  collin: {
    cadName: 'Collin Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.collincad.org/', website: 'https://www.collincad.org', mailTo: '250 Eldorado Pkwy., McKinney, TX 75069-8023', phone: '469-742-9200' },
  },
  // Collingsworth County
  collingsworth: {
    cadName: null,
    fileBy: { website: 'https://www.collingsworthcad.org', mailTo: '800 West Ave., Box 9, Wellington, TX 79095-3037', phone: '806-447-5172' },
  },
  // Colorado County
  colorado: {
    cadName: 'Colorado County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.coloradocad.org/', website: 'https://coloradocad.org', mailTo: 'P.O. Box 10, Columbus, TX 78934-0010', phone: '979-732-8222' },
  },
  // Comal County
  comal: {
    cadName: 'Comal Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.comalad.org/', website: 'https://comalad.org', mailTo: '900 S. Seguin Ave., New Braunfels, TX 78130-7838', phone: '830-625-8597' },
  },
  // Comanche County
  comanche: {
    cadName: null,
    fileBy: { website: 'https://www.comanchecad.org', mailTo: '8 Huett Cir., Comanche, TX 76442-2049', phone: '325-356-5253' },
  },
  // Concho County
  concho: {
    cadName: null,
    fileBy: { website: 'https://www.conchocad.org', mailTo: 'P.O. Box 68, Paint Rock, TX 76866-0068', phone: '325-732-4389' },
  },
  // Cooke County
  cooke: {
    cadName: null,
    fileBy: { website: 'https://www.cookecad.org', mailTo: '201 N. Dixon St., Gainesville, TX 76240-3974', phone: '940-665-7651' },
  },
  // Coryell County
  coryell: {
    cadName: null,
    fileBy: { website: 'https://www.coryellcad.org', mailTo: '705 E. Main St., Gatesville, TX 76528', phone: '254-865-6593' },
  },
  // Cottle County
  cottle: {
    cadName: null,
    fileBy: { website: 'https://www.cottlecad.org', mailTo: 'P.O. Box 459, Paducah, TX 79248-0459', phone: '806-492-3345' },
  },
  // Crane County
  crane: {
    cadName: null,
    fileBy: { website: 'https://www.cranecad.org', mailTo: '511 W. 8th St., Crane, TX 79731-3036', phone: '432-558-1021' },
  },
  // Crockett County
  crockett: {
    cadName: null,
    fileBy: { mailTo: 'P.O. Box 1569, Ozona, TX 76943', phone: '325-392-8258' },
  },
  // Crosby County
  crosby: {
    cadName: null,
    fileBy: { website: 'https://www.crosbycentral.org', mailTo: 'P.O. Box 505, Crosbyton, TX 79322-0505', phone: '806-675-2356' },
  },
  // Culberson County
  culberson: {
    cadName: null,
    fileBy: { website: 'https://www.culbersoncad.org', mailTo: 'P.O. Box 550, Van Horn, TX 79855-0550', phone: '432-283-2977' },
  },
  // Dallam County
  dallam: {
    cadName: null,
    fileBy: { website: 'https://www.dallamcad.org', mailTo: 'P.O. Box 579, Dalhart, TX 79022-0579', phone: '806-249-6767' },
  },
  // Dallas County
  dallas: {
    // DCAD files through uFile, but there's no direct deep link — the portal
    // opens on a property search and the uFile link only appears once you open
    // your account. efileNote carries that step through to the UI.
    cadName: 'Dallas Central Appraisal District',
    fileBy: {
      efileUrl: 'https://www.dallascad.org/searchaddr.aspx',
      efileNote: 'Search your address there, open your account, then choose the uFile Online Protest link on the account page.',
      efileGuideUrl: 'https://www.dallascad.org/webForms/UFILEONLINE/uFile_Script_Video_2025.pdf',
      website: 'https://www.dallascad.org',
      mailTo: '2949 N Stemmons Fwy, Dallas, TX 75247-6102',
      phone: '214-631-0910',
      evidenceHowTo: 'To see the Dallas Central Appraisal District (DCAD) evidence used to value your property, use the 17-digit account number and the PIN from your Hearing Notice to log into the [DCAD Online Protest System](https://www.dallascad.org/SearchAcct.aspx). DCAD posts this evidence online 14 days before your scheduled hearing.',
    },
  },
  // Dawson County
  dawson: {
    cadName: null,
    fileBy: { website: 'https://www.dawsoncad.org', mailTo: 'P.O. Box 797, Lamesa, TX 79331-0797', phone: '806-872-7060' },
  },
  // Deaf Smith County
  deafsmith: {
    cadName: null,
    fileBy: { website: 'https://www.deafsmithcad.org', mailTo: 'P.O. Box 2298, Hereford, TX 79045-2298', phone: '806-364-0625' },
  },
  // Delta County
  delta: {
    cadName: null,
    fileBy: { website: 'https://www.delta-cad.org', mailTo: 'P.O. Box 47, Cooper, TX 75432-0047', phone: '903-395-4118' },
  },
  // Denton County
  denton: {
    cadName: 'Denton Central Appraisal District',
    fileBy: { efileUrl: 'https://appeals.dentoncad.com/', website: 'https://www.dentoncad.com', mailTo: '3911 Morse St., Denton, TX 76208-6331', phone: '940-349-3800' },
  },
  // DeWitt County
  dewitt: {
    cadName: null,
    fileBy: { website: 'https://www.dewittcad.org', mailTo: '103 E. Bailey St., Cuero, TX 77954-2400', phone: '361-275-5753' },
  },
  // Dickens County
  dickens: {
    cadName: null,
    fileBy: { mailTo: 'P.O. Box 180, Dickens, TX 79229-0180', phone: '806-623-5258' },
  },
  // Dimmit County
  dimmit: {
    cadName: null,
    fileBy: { website: 'https://www.dimmit-cad.org', mailTo: '203 W Houston St., Carrizo Springs, TX 78834', phone: '830-876-3420' },
  },
  // Donley County
  donley: {
    cadName: null,
    fileBy: { website: 'https://www.donleycad.org', mailTo: 'P.O. Box 1220, Clarendon, TX 79226-1220', phone: '806-874-2744' },
  },
  // Duval County
  duval: {
    cadName: null,
    fileBy: { website: 'https://www.duvalcad.org', mailTo: 'P.O. Box 809, San Diego, TX 78384-0809', phone: '361-279-3305' },
  },
  // Eastland County
  eastland: {
    cadName: null,
    fileBy: { website: 'https://www.eastlandcad.org', mailTo: '211 Inspiration Blvd., Eastland, TX 76448-5514', phone: '254-629-8597' },
  },
  // Ector County
  ector: {
    cadName: null,
    fileBy: { website: 'https://www.ectorcad.org', mailTo: '1301 E. 8th St., Odessa, TX 79761-4703', phone: '432-332-6834' },
  },
  // Edwards County
  edwards: {
    cadName: null,
    fileBy: { website: 'https://edwardscad.org', mailTo: 'P.O. Box 858, Rocksprings, TX 78880-0858', phone: '830-683-4189' },
  },
  // Ellis County
  ellis: {
    cadName: 'Ellis Appraisal District',
    fileBy: { efileUrl: 'https://www.elliscad.org/file-your-protest', website: 'https://www.elliscad.org', mailTo: 'P.O. Box 878, Waxahachie, TX 75168-0878', phone: '972-937-3552' },
  },
  // El Paso County
  elpaso: {
    cadName: 'El Paso Central Appraisal District',
    fileBy: { efileUrl: 'https://epcad.org/OnlineServices/ProtestPortal', website: 'https://epcad.org', mailTo: '5801 Trowbridge Dr., El Paso, TX 79925-3345', phone: '915-780-2131' },
  },
  // Erath County
  erath: {
    cadName: null,
    fileBy: { website: 'https://www.erath-cad.com', mailTo: '1195 W. South Loop, Stephenville, TX 76401-2026', phone: '254-965-5434' },
  },
  // Falls County
  falls: {
    cadName: null,
    fileBy: { website: 'https://www.fallscad.net', mailTo: '403 Craik St., Marlin, TX 76661-2817', phone: '254-883-2543' },
  },
  // Fannin County
  fannin: {
    cadName: 'Fannin County Appraisal District',
    fileBy: { website: 'https://fannincad.org', mailTo: '831 W. State Hwy. 56, Bonham, TX 75418-8604', phone: '903-583-8701' },
  },
  // Fayette County
  fayette: {
    cadName: null,
    fileBy: { website: 'https://www.fayettecad.org', mailTo: 'P.O. Box 836, La Grange, TX 78945-0836', phone: '979-968-8383' },
  },
  // Fisher County
  fisher: {
    cadName: null,
    fileBy: { website: 'https://www.fishercad.org', mailTo: 'P.O. Box 516, Roby, TX 79543-0516', phone: '325-776-2733' },
  },
  // Floyd County
  floyd: {
    cadName: null,
    fileBy: { website: 'https://www.floydcad.org', mailTo: 'P.O. Box 249, Floydada, TX 79235-0249', phone: '806-983-5256' },
  },
  // Foard County
  foard: {
    cadName: null,
    fileBy: { website: 'https://www.foardcad.org', mailTo: 'P.O. Box 419, Crowell, TX 79227-0419', phone: '940-684-1225' },
  },
  // Fort Bend County
  fortbend: {
    cadName: 'Fort Bend Central Appraisal District',
    fileBy: { efileUrl: 'https://webappeals.fbcad.org/', website: 'https://www.fbcad.org', mailTo: '2801 B.F. Terry Blvd., Rosenberg, TX 77471-5600', phone: '281-344-8623' },
  },
  // Franklin County
  franklin: {
    cadName: 'Franklin County Appraisal District',
    fileBy: { website: 'https://franklin-cad.org', mailTo: 'P.O. Box 720, Mount Vernon, TX 75457-0720', phone: '903-537-2286' },
  },
  // Freestone County
  freestone: {
    cadName: 'Freestone Central Appraisal District',
    fileBy: { website: 'https://www.freestonecad.org', mailTo: '218 N. Mount St., Fairfield, TX 75840-3144', phone: '903-389-5510' },
  },
  // Frio County
  frio: {
    cadName: null,
    fileBy: { website: 'https://www.friocad.org', mailTo: 'P.O. Box 1129, Pearsall, TX 78061-1129', phone: '830-334-4163' },
  },
  // Gaines County
  gaines: {
    cadName: null,
    fileBy: { website: 'https://www.gainescad.org', mailTo: 'P.O. Box 490, Seminole, TX 79360-0490', phone: '432-758-3263' },
  },
  // Galveston County
  galveston: {
    cadName: 'Galveston Central Appraisal District',
    fileBy: { efileUrl: 'https://portal.galvestoncad.org/', website: 'https://galvestoncad.org', mailTo: '9850 Emmett F. Lowry Expwy, Suite A, Texas City, TX 77591', phone: '409-935-1980' },
  },
  // Garza County
  garza: {
    cadName: null,
    fileBy: { website: 'https://www.garzacad.org', mailTo: 'P.O. Drawer F, Post, TX 79356-0290', phone: '806-495-3518' },
  },
  // Gillespie County
  gillespie: {
    cadName: null,
    fileBy: { website: 'https://www.gillespiecad.org', mailTo: '1159 S. Milam St., Fredericksburg, TX 78624', phone: '830-997-9807' },
  },
  // Glasscock County
  glasscock: {
    cadName: null,
    fileBy: { website: 'https://www.glasscockcad.org', mailTo: 'P.O. Box 155, Garden City, TX 79739-0155', phone: '432-203-2215' },
  },
  // Goliad County
  goliad: {
    cadName: null,
    fileBy: { website: 'https://goliadcad.org', mailTo: 'P.O. Box 34, Goliad, TX 77963-0034', phone: '361-645-2507' },
  },
  // Gonzales County
  gonzales: {
    cadName: null,
    fileBy: { website: 'https://www.gonzalescad.org', mailTo: 'P.O. Box 867, Gonzales, TX 78629-0867', phone: '830-672-2879' },
  },
  // Gray County
  gray: {
    cadName: null,
    fileBy: { website: 'https://www.graycad.org', mailTo: 'P.O. Box 836, Pampa, TX 79066-0836', phone: '806-665-0791' },
  },
  // Grayson County
  grayson: {
    cadName: 'Grayson Central Appraisal District',
    fileBy: { efileUrl: 'https://protest.graysonappraisal.org/', website: 'https://graysonappraisal.org', mailTo: '512 N. Travis St., Sherman, TX 75090', phone: '903-893-9673' },
  },
  // Gregg County
  gregg: {
    cadName: 'Gregg County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.gcad.org', website: 'https://gcad.org', mailTo: '4367 W. Loop 281, Longview, TX 75604-5550', phone: '903-238-8823' },
  },
  // Grimes County
  grimes: {
    cadName: 'Grimes Central Appraisal District',
    fileBy: { efileUrl: 'https://www.grimescad.org/onlineappeals', website: 'https://grimescad.org', mailTo: 'P.O. Box 489, Anderson, TX 77830-0489', phone: '936-873-2163' },
  },
  // Guadalupe County
  guadalupe: {
    cadName: null,
    fileBy: { website: 'https://www.guadalupead.org', mailTo: '3000 N. Austin St., Seguin, TX 78155-7320', phone: '830-303-3313' },
  },
  // Hale County
  hale: {
    cadName: null,
    fileBy: { website: 'https://www.halecad.org', mailTo: 'P.O. Box 29, Plainview, TX 79073-0029', phone: '806-293-4226' },
  },
  // Hall County
  hall: {
    cadName: null,
    fileBy: { website: 'https://www.hallcad.org', mailTo: '112 S 5th St., Memphis, TX 79245-3412', phone: '806-259-2393' },
  },
  // Hamilton County
  hamilton: {
    cadName: null,
    fileBy: { website: 'https://www.hamiltoncad.org', mailTo: 'P.O. Box 352, Hamilton, TX 76531-0352', phone: '254-386-8945' },
  },
  // Hansford County
  hansford: {
    cadName: null,
    fileBy: { website: 'https://www.hansfordcad.org', mailTo: '709 W. 7th Avenue, Spearman, TX 79081', phone: '806-659-5575' },
  },
  // Hardeman County
  hardeman: {
    cadName: null,
    fileBy: { website: 'https://www.hardemancad.org', mailTo: 'P.O. Box 388, Quanah, TX 79252-0388', phone: '940-663-2532' },
  },
  // Hardin County
  hardin: {
    cadName: null,
    fileBy: { website: 'https://hardin-cad.org', mailTo: 'P.O. Box 670, Kountze, TX 77625-0670', phone: '409-246-2507' },
  },
  // Harris County
  harris: {
    cadName: 'Harris Central Appraisal District',
    fileBy: {
      efileUrl: 'https://owners.hcad.org',
      website: 'https://hcad.org',
      mailTo: 'P.O. Box 924208, Houston, TX 77292-4208',
      phone: '713-957-7800',
      // Verified 2026-07-22 against hcad.org / owners.hcad.org.
      evidenceHowTo: "To see the evidence Harris Central Appraisal District (HCAD) used to value your property, log into the [HCAD owners portal](https://owners.hcad.org) using your account number and iFile number — both printed in the upper-right corner of your Notice of Appraised Value. HCAD's evidence is available to view there, and the district must make it available to you at least 14 days before your hearing (Texas Tax Code §41.461).",
    },
  },
  // Harrison County
  harrison: {
    cadName: null,
    fileBy: { website: 'https://www.harrisoncad.net', mailTo: 'P.O. Box 818, Marshall, TX 75671-0818', phone: '903-935-1991' },
  },
  // Hartley County
  hartley: {
    cadName: null,
    fileBy: { website: 'https://www.hartleycad.org', mailTo: 'P.O. Box 405, Hartley, TX 79044-0405', phone: '806-365-4515' },
  },
  // Haskell County
  haskell: {
    cadName: null,
    fileBy: { website: 'https://www.haskellcad.com', mailTo: 'P.O. Box 467, Haskell, TX 79521-0467', phone: '940-864-3805' },
  },
  // Hays County
  hays: {
    cadName: null,
    fileBy: { website: 'https://www.hayscad.com', mailTo: '21001 N. IH 35, Kyle, TX 78640-4795', phone: '512-268-2522' },
  },
  // Hemphill County
  hemphill: {
    cadName: null,
    fileBy: { website: 'https://hemphillcad.org', mailTo: '102 N. 5th St., Canadian, TX 79014-2228', phone: '806-323-8022' },
  },
  // Henderson County
  henderson: {
    cadName: null,
    fileBy: { website: 'https://www.henderson-cad.org', mailTo: 'P.O. Box 430, Athens, TX 75751-0430', phone: '903-675-9296' },
  },
  // Hidalgo County
  hidalgo: {
    cadName: null,
    fileBy: { website: 'https://www.hidalgoad.org', mailTo: 'P.O. Box 208, Edinburg, TX 78540-0208', phone: '956-381-8466' },
  },
  // Hill County
  hill: {
    cadName: null,
    fileBy: { website: 'https://www.hillcad.org', mailTo: 'P.O. Box 416, Hillsboro, TX 76645-0416', phone: '254-582-2508' },
  },
  // Hockley County
  hockley: {
    cadName: null,
    fileBy: { website: 'https://www.hockleycad.org', mailTo: 'P.O. Box 1090, Levelland, TX 79336-1090', phone: '806-894-9654' },
  },
  // Hood County
  hood: {
    cadName: 'Hood Central Appraisal District',
    fileBy: { efileUrl: 'https://hoodcad.net/online-protest/', website: 'https://hoodcad.net', mailTo: 'P.O. Box 819, Granbury, TX 76048-0819', phone: '817-573-2471' },
  },
  // Hopkins County
  hopkins: {
    cadName: null,
    fileBy: { website: 'https://www.hopkinscad.com', mailTo: 'P.O. Box 753, Sulphur Springs, TX 75482-0753', phone: '903-885-2173' },
  },
  // Houston County
  houston: {
    cadName: null,
    fileBy: { website: 'https://www.houstoncad.org', mailTo: 'P.O. Box 112, Crockett, TX 75835-0112', phone: '936-544-9655' },
  },
  // Howard County
  howard: {
    cadName: null,
    fileBy: { website: 'https://www.howardcad.org', mailTo: 'P.O. Drawer 1151, Big Spring, TX 79721-1151', phone: '432-263-8301' },
  },
  // Hudspeth County
  hudspeth: {
    cadName: null,
    fileBy: { website: 'https://www.hudspethcad.org', mailTo: 'P.O. Box 429, Sierra Blanca, TX 79851-0429', phone: '915-369-4118' },
  },
  // Hunt County
  hunt: {
    cadName: 'Hunt County Appraisal District',
    fileBy: { efileUrl: 'https://hunt-cad.org/online-protest/', website: 'https://hunt-cad.org', mailTo: 'P.O. Box 1339, Greenville, TX 75403-1339', phone: '903-454-3510' },
  },
  // Hutchinson County
  hutchinson: {
    cadName: null,
    fileBy: { website: 'https://www.hutchinsoncad.org', mailTo: '920 Illinois Ave., Borger, TX 79007-6112', phone: '806-274-2294' },
  },
  // Irion County
  irion: {
    cadName: null,
    fileBy: { website: 'https://www.irioncad.org', mailTo: 'P.O. Box 980, Mertzon, TX 76941-0980', phone: '325-835-3551' },
  },
  // Jack County
  jack: {
    cadName: null,
    fileBy: { website: 'https://www.jackcad.org', mailTo: 'P.O. Box 958, Jacksboro, TX 76458-0958', phone: '940-567-6301' },
  },
  // Jackson County
  jackson: {
    cadName: null,
    fileBy: { website: 'https://www.jacksoncad.org', mailTo: '404 N. Allen St., Edna, TX 77957-2604', phone: '361-782-7115' },
  },
  // Jasper County
  jasper: {
    cadName: null,
    fileBy: { website: 'https://www.jaspercad.org', mailTo: '137 N. Main St., Jasper, TX 75951-4111', phone: '409-384-2544' },
  },
  // Jeff Davis County
  jeffdavis: {
    cadName: 'Jeff Davis County Appraisal District',
    fileBy: { efileUrl: 'https://www.jeffdaviscad.org/protest', website: 'https://www.jeffdaviscad.org', mailTo: 'P.O. Box 373, Fort Davis, TX 79734-0373', phone: '432-426-3210' },
  },
  // Jefferson County
  jefferson: {
    cadName: null,
    fileBy: { website: 'https://www.jcad.org', mailTo: 'P.O. Box 21337, Beaumont, TX 77720', phone: '409-840-9944' },
  },
  // Jim Hogg County
  jimhogg: {
    cadName: null,
    fileBy: { website: 'https://www.jimhogg-cad.org', mailTo: 'P.O. Box 459, Hebbronville, TX 78361-0459', phone: '361-527-4033' },
  },
  // Jim Wells County
  jimwells: {
    cadName: null,
    fileBy: { website: 'https://www.jimwellscad.org', mailTo: 'P.O. Box 607, Alice, TX 78333-0607', phone: '361-668-9656' },
  },
  // Johnson County
  johnson: {
    cadName: 'Central Appraisal District of Johnson County',
    fileBy: { efileUrl: 'https://johnsoncad.com/online-protest-portal/', website: 'https://johnsoncad.com', mailTo: '109 N. Main St., Cleburne, TX 76033-4941', phone: '817-648-3000' },
  },
  // Jones County
  jones: {
    cadName: null,
    fileBy: { website: 'https://www.jonescad.org', mailTo: 'P.O. Box 348, Anson, TX 79501-0348', phone: '325-823-2422' },
  },
  // Karnes County
  karnes: {
    cadName: null,
    fileBy: { website: 'https://www.karnescad.org', mailTo: '915 S. Panna Maria Ave., Karnes City, TX 78118-4105', phone: '830-780-2433' },
  },
  // Kaufman County
  kaufman: {
    cadName: 'Kaufman County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.kaufman-cad.org/', website: 'https://kaufman-cad.org', mailTo: 'P.O. Box 819, Kaufman, TX 75142-0819', phone: '972-932-6081' },
  },
  // Kendall County
  kendall: {
    cadName: null,
    fileBy: { website: 'https://www.kendallad.org', mailTo: '118 Market Ave., Boerne, TX 78006', phone: '830-249-8012' },
  },
  // Kenedy County
  kenedy: {
    cadName: null,
    fileBy: { website: 'https://www.kenedycad.org', mailTo: 'P.O. Box 39, Sarita, TX 78385-0039', phone: '361-294-5333' },
  },
  // Kent County
  kent: {
    cadName: null,
    fileBy: { website: 'https://www.kentcad.org', mailTo: 'P.O. Box 68, Jayton, TX 79528-0068', phone: '806-237-3066' },
  },
  // Kerr County
  kerr: {
    cadName: 'Kerr Central Appraisal District',
    fileBy: { efileUrl: 'https://portal.kerrcad.org/', website: 'https://kerrcad.org', mailTo: 'P.O. Box 294387, Kerrville, TX 78029-4387', phone: '830-895-5223' },
  },
  // Kimble County
  kimble: {
    cadName: null,
    fileBy: { website: 'https://www.kimblecad.org', mailTo: 'P.O. Box 307, Junction, TX 76849-0307', phone: '325-446-3717' },
  },
  // King County
  king: {
    cadName: null,
    fileBy: { website: 'https://www.kingcad.org', mailTo: 'P.O. Box 117, Guthrie, TX 79236-0117', phone: '806-596-4588' },
  },
  // Kinney County
  kinney: {
    cadName: null,
    fileBy: { website: 'https://www.kinneycad.org', mailTo: 'P.O. Box 1377, Brackettville, TX 78832-1377', phone: '830-563-2323' },
  },
  // Kleberg County
  kleberg: {
    cadName: 'Kleberg County Appraisal District',
    fileBy: { website: 'https://kleberg-cad.org', mailTo: 'P.O. Box 1027, Kingsville, TX 78363-1027', phone: '361-595-5775' },
  },
  // Knox County
  knox: {
    cadName: null,
    fileBy: { website: 'https://www.knoxcad.com', mailTo: 'P.O. Box 47, Benjamin, TX 79505-0047', phone: '940-459-3891' },
  },
  // Lamar County
  lamar: {
    cadName: null,
    fileBy: { website: 'https://www.lamarcad.org', mailTo: 'P.O. Box 400, Paris, TX 75461-0400', phone: '903-785-7822' },
  },
  // Lamb County
  lamb: {
    cadName: null,
    fileBy: { website: 'https://www.lambcad.org', mailTo: 'P.O. Box 950, Littlefield, TX 79339-0950', phone: '806-385-6474' },
  },
  // Lampasas County
  lampasas: {
    cadName: null,
    fileBy: { website: 'https://www.lampasascad.com', mailTo: 'P.O. Box 175, Lampasas, TX 76550-0175', phone: '512-556-8058' },
  },
  // La Salle County
  lasalle: {
    cadName: null,
    fileBy: { website: 'https://www.lasallecad.com', mailTo: 'P.O. Box 1530, Cotulla, TX 78014-1530', phone: '830-879-4756' },
  },
  // Lavaca County
  lavaca: {
    cadName: null,
    fileBy: { website: 'https://www.lavacacad.com', mailTo: 'P.O. Box 386, Hallettsville, TX 77964-0386', phone: '361-798-4396' },
  },
  // Lee County
  lee: {
    cadName: null,
    fileBy: { website: 'https://www.lee-cad.org', mailTo: '898 E. Richmond St., Suite 100, Giddings, TX 78942-4252', phone: '979-542-9618' },
  },
  // Leon County
  leon: {
    cadName: null,
    fileBy: { website: 'https://www.leoncad.org', mailTo: 'P.O. Box 536, Centerville, TX 75833-0536', phone: '903-536-2252' },
  },
  // Liberty County
  liberty: {
    cadName: null,
    fileBy: { website: 'https://www.libertycad.com', mailTo: 'P.O. Box 10016, Liberty, TX 77575-2916', phone: '936-336-5722' },
  },
  // Limestone County
  limestone: {
    cadName: 'Limestone County Appraisal District',
    fileBy: { website: 'https://www.limestonecad.com', mailTo: '303 S. Waco St., Groesbeck, TX 76642-1726', phone: '254-729-3009' },
  },
  // Lipscomb County
  lipscomb: {
    cadName: null,
    fileBy: { website: 'https://www.lipscombcad.com', mailTo: 'P.O. Box 128, Darrouzett, TX 79024-0128', phone: '806-624-2881' },
  },
  // Live Oak County
  liveoak: {
    cadName: null,
    fileBy: { website: 'https://www.liveoakappraisal.com', mailTo: 'P.O. Box 2370, George West, TX 78022-2370', phone: '361-449-2641' },
  },
  // Llano County
  llano: {
    cadName: null,
    fileBy: { website: 'https://www.llanocad.net', mailTo: '103 E. Sandstone St., Llano, TX 78643-2039', phone: '325-247-3065' },
  },
  // Loving County
  loving: {
    cadName: null,
    fileBy: { website: 'https://www.lovingcad.org', mailTo: 'P.O. Box 352, Mentone, TX 79754-0352', phone: '432-377-2201' },
  },
  // Lubbock County
  lubbock: {
    cadName: 'Lubbock Central Appraisal District',
    fileBy: { efileUrl: 'https://lubbockcad.org/OnlineAppeals', website: 'https://lubbockcad.org', mailTo: 'P.O. Box 10542, Lubbock, TX 79408-0542', phone: '806-762-5000' },
  },
  // Lynn County
  lynn: {
    cadName: null,
    fileBy: { website: 'https://www.lynncad.org', mailTo: 'P.O. Box 789, Tahoka, TX 79373-0789', phone: '806-561-5477' },
  },
  // Madison County
  madison: {
    cadName: null,
    fileBy: { website: 'https://www.madisoncad.org', mailTo: 'P.O. Box 1328, Madisonville, TX 77864-1328', phone: '936-348-2783' },
  },
  // Marion County
  marion: {
    cadName: null,
    fileBy: { website: 'https://www.marioncad.org', mailTo: '801 North Tuttle St., Jefferson, TX 75657', phone: '903-665-2519' },
  },
  // Martin County
  martin: {
    cadName: null,
    fileBy: { website: 'https://www.martincad.org', mailTo: 'P.O. Box 1349, Stanton, TX 79782-1349', phone: '432-756-2823' },
  },
  // Mason County
  mason: {
    cadName: null,
    fileBy: { website: 'https://www.masoncad.org', mailTo: 'P.O. Box 1119, Mason, TX 76856-1119', phone: '325-347-5989' },
  },
  // Matagorda County
  matagorda: {
    cadName: 'Matagorda County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.matagorda-cad.org/', website: 'https://matagorda-cad.org', mailTo: '2225 Avenue G, Bay City, TX 77414-5018', phone: '979-244-2031' },
  },
  // Maverick County
  maverick: {
    cadName: null,
    fileBy: { website: 'https://www.maverickcad.org', mailTo: 'P.O. Box 2628, Eagle Pass, TX 78853-2628', phone: '830-773-0255' },
  },
  // McCulloch County
  mcculloch: {
    cadName: null,
    fileBy: { website: 'https://www.mccullochcad.org', mailTo: '306 W. Lockhart St., Brady, TX 76825-4113', phone: '325-597-1627' },
  },
  // McLennan County
  mclennan: {
    cadName: 'McLennan Central Appraisal District',
    fileBy: { efileUrl: 'https://mclennancad.org/efile/', website: 'https://mclennancad.org', mailTo: '315 S. 26th St., Waco, TX 76710-7400', phone: '254-752-9864' },
  },
  // McMullen County
  mcmullen: {
    cadName: null,
    fileBy: { website: 'https://www.mcmullencad.org', mailTo: 'P.O. Box 338, Tilden, TX 78072-0038', phone: '361-274-3638' },
  },
  // Medina County
  medina: {
    cadName: null,
    fileBy: { website: 'https://www.medinacad.org', mailTo: '1410 Avenue K, Hondo, TX 78861-1300', phone: '830-741-3035' },
  },
  // Menard County
  menard: {
    cadName: null,
    fileBy: { website: 'https://www.menardcad.org', mailTo: 'P.O. Box 1008, Menard, TX 76859-1008', phone: '325-396-4784' },
  },
  // Midland County
  midland: {
    cadName: 'Midland Central Appraisal District',
    fileBy: { website: 'https://midcad.org', mailTo: 'P.O. Box 908002, Midland, TX 79703-8002', phone: '432-699-4991' },
  },
  // Milam County
  milam: {
    cadName: null,
    fileBy: { website: 'https://www.milamad.org', mailTo: 'P.O. Box 769, Cameron, TX 76520-0769', phone: '254-697-6638' },
  },
  // Mills County
  mills: {
    cadName: null,
    fileBy: { website: 'https://www.millscad.org', mailTo: 'P.O. Box 565, Goldthwaite, TX 76844-0565', phone: '325-648-2253' },
  },
  // Mitchell County
  mitchell: {
    cadName: null,
    fileBy: { website: 'https://www.mitchellcad.org', mailTo: '2112 Hickory St., Colorado City, TX 79512-3448', phone: '325-728-5028' },
  },
  // Montague County
  montague: {
    cadName: null,
    fileBy: { website: 'https://iswdataclient.azurewebsites.net', mailTo: 'P.O. Box 121, Montague, TX 76251-0121', phone: '940-894-6011' },
  },
  // Montgomery County
  montgomery: {
    cadName: 'Montgomery Central Appraisal District',
    fileBy: { efileUrl: 'https://www.onlineappeals.mcad-tx.org/', website: 'https://mcad-tx.org', mailTo: 'P.O. Box 2233, Conroe, TX 77305-2233', phone: '936-756-3354' },
  },
  // Moore County
  moore: {
    cadName: null,
    fileBy: { website: 'https://www.moorecad.org', mailTo: 'P.O. Box 717, Dumas, TX 79029-0717', phone: '806-935-4193' },
  },
  // Morris County
  morris: {
    cadName: null,
    fileBy: { website: 'https://www.morriscad.com', mailTo: 'P.O. Box 563, Daingerfield, TX 75638-0563', phone: '903-645-5601' },
  },
  // Motley County
  motley: {
    cadName: null,
    fileBy: { mailTo: 'P.O. Box 249, Floydada, TX 79235-0249', phone: '806-983-5256' },
  },
  // Nacogdoches County
  nacogdoches: {
    cadName: null,
    fileBy: { website: 'https://www.nacocad.org', mailTo: '216 W. Hospital St., Nacogdoches, TX 75961-4873', phone: '936-560-3447' },
  },
  // Navarro County
  navarro: {
    cadName: null,
    fileBy: { website: 'https://www.navarrocad.com', mailTo: '1250 N. 45th St., Corsicana, TX 75110-3172', phone: '903-872-6161' },
  },
  // Newton County
  newton: {
    cadName: null,
    fileBy: { website: 'https://www.newtoncad.org', mailTo: '109 Court St., Newton, TX 75966-3202', phone: '409-379-3710' },
  },
  // Nolan County
  nolan: {
    cadName: null,
    fileBy: { website: 'https://www.nolan-cad.org', mailTo: 'P.O. Box 1256, Sweetwater, TX 79556-1256', phone: '325-235-8421' },
  },
  // Nueces County
  nueces: {
    cadName: 'Nueces Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.nuecescad.net/', website: 'https://nuecescad.net', mailTo: '201 N. Chaparral St., Corpus Christi, TX 78401-2503', phone: '361-881-9978' },
  },
  // Ochiltree County
  ochiltree: {
    cadName: null,
    fileBy: { website: 'https://www.ochiltreecad.org', mailTo: '825 S. Main St., Ste. 100, Perryton, TX 79070-3556', phone: '806-435-9623' },
  },
  // Oldham County
  oldham: {
    cadName: 'Oldham County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.oldhamcad.org/', website: 'https://oldhamcad.org', mailTo: 'P.O. Box 310, Vega, TX 79092-0310', phone: '806-267-2442' },
  },
  // Orange County
  orange: {
    cadName: null,
    fileBy: { website: 'https://www.orangecad.net', mailTo: 'P.O. Box 457, Orange, TX 77631', phone: '409-745-4777' },
  },
  // Palo Pinto County
  palopinto: {
    cadName: null,
    fileBy: { website: 'https://Palo Pinto Appraisal District', mailTo: 'P.O. Box 250, Palo Pinto, TX 76484-0250', phone: '940-659-1281' },
  },
  // Panola County
  panola: {
    cadName: null,
    fileBy: { website: 'https://www.panolacad.org', mailTo: '1736 Ball Park Dr., Carthage, TX 75633-3368', phone: '903-693-2891' },
  },
  // Parker County
  parker: {
    cadName: 'Parker County Appraisal District',
    fileBy: { website: 'https://www.parkercad.org', mailTo: '1108 Santa Fe Dr., Weatherford, TX 76086-5818', phone: '817-596-0077' },
  },
  // Parmer County
  parmer: {
    cadName: null,
    fileBy: { website: 'https://www.parmercad.org', mailTo: 'P.O. Box 56, Bovina, TX 79009-0056', phone: '806-251-1405' },
  },
  // Pecos County
  pecos: {
    cadName: null,
    fileBy: { website: 'https://www.pecoscad.org', mailTo: 'P.O. Box 237, Fort Stockton, TX 79735-0237', phone: '432-336-7587' },
  },
  // Polk County
  polk: {
    cadName: null,
    fileBy: { website: 'https://www.polkcad.org', mailTo: '114 Matthews St., Livingston, TX 77351-3425', phone: '936-327-2174' },
  },
  // Potter County
  potter: {
    cadName: null,
    fileBy: { website: 'https://www.prad.org', mailTo: 'P.O. Box 7190, Amarillo, TX 79114-7190', phone: '806-358-1601' },
  },
  // Presidio County
  presidio: {
    cadName: 'Presidio County Appraisal District',
    fileBy: { efileUrl: 'https://portal.presidiocad.org/', website: 'https://presidiocad.org', mailTo: 'P.O. Box 879, Marfa, TX 79843-0879', phone: '432-729-3431' },
  },
  // Rains County
  rains: {
    cadName: null,
    fileBy: { website: 'https://www.rainscad.org', mailTo: 'P.O. Box 70, Emory, TX 75440-0070', phone: '903-473-2391' },
  },
  // Randall County
  randall: {
    cadName: null,
    fileBy: { website: 'https://www.prad.org', mailTo: 'P.O. Box 7190, Amarillo, TX 79114-7190', phone: '806-358-1601' },
  },
  // Reagan County
  reagan: {
    cadName: null,
    fileBy: { website: 'https://www.reagancad.org', mailTo: 'P.O. Box 8, Big Lake, TX 76932-0008', phone: '325-884-3275' },
  },
  // Real County
  real: {
    cadName: null,
    fileBy: { website: 'https://www.realcad.org', mailTo: 'P.O. Box 158, Leakey, TX 78873-0158', phone: '830-232-6248' },
  },
  // Red River County
  redriver: {
    cadName: null,
    fileBy: { website: 'https://www.rrcad.org', mailTo: 'P.O. Box 461, Clarksville, TX 75426-0461', phone: '903-427-4181' },
  },
  // Reeves County
  reeves: {
    cadName: null,
    fileBy: { website: 'https://www.reeves-cad.org', mailTo: 'P.O. Box 1229, Pecos, TX 79772-1229', phone: '432-445-5122' },
  },
  // Refugio County
  refugio: {
    cadName: null,
    fileBy: { website: 'https://www.refugiocad.org', mailTo: 'P.O. Box 156, Refugio, TX 78377-0156', phone: '361-526-5994' },
  },
  // Roberts County
  roberts: {
    cadName: null,
    fileBy: { website: 'https://www.robertscad.org', mailTo: '300 E. Commercial St., Ste. 102, Miami, TX 79059-2440', phone: '806-868-5281' },
  },
  // Robertson County
  robertson: {
    cadName: null,
    fileBy: { website: 'https://robertsoncad.com', mailTo: 'P.O. Box 998, Franklin, TX 77856-0998', phone: '979-828-5800' },
  },
  // Rockwall County
  rockwall: {
    cadName: 'Rockwall Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.rockwallcad.com/', website: 'https://www.rockwallcad.com', mailTo: '841 Justin Rd., Rockwall, TX 75087-4842', phone: '972-771-2034' },
  },
  // Runnels County
  runnels: {
    cadName: null,
    fileBy: { website: 'https://www.runnelscad.org', mailTo: 'P.O. Box 524, Ballinger, TX 76821-0524', phone: '325-365-3583' },
  },
  // Rusk County
  rusk: {
    cadName: 'Rusk County Appraisal District',
    fileBy: { website: 'https://www.ruskcad.org', mailTo: 'P.O. Box 7, Henderson, TX 75652-0007', phone: '903-657-3578' },
  },
  // Sabine County
  sabine: {
    cadName: null,
    fileBy: { website: 'https://Sabine County Appraisal District', mailTo: 'P.O. Box 137, Hemphill, TX 75948-0137', phone: '409-787-2777' },
  },
  // San Augustine County
  sanaugustine: {
    cadName: null,
    fileBy: { website: 'https://www.sanaugustinecad.org', mailTo: '122 N. Harrison St., San Augustine, TX 75972-1906', phone: '936-275-3496' },
  },
  // San Jacinto County
  sanjacinto: {
    cadName: 'San Jacinto County Appraisal District',
    fileBy: { website: 'https://sjcad.org', mailTo: 'P.O. Box 1170, Coldspring, TX 77331-1170', phone: '936-653-1450' },
  },
  // San Patricio County
  sanpatricio: {
    cadName: null,
    fileBy: { website: 'https://www.sanpatcad.org', mailTo: 'P.O. Box 938, Sinton, TX 78387-0938', phone: '361-364-5402' },
  },
  // San Saba County
  sansaba: {
    cadName: null,
    fileBy: { website: 'https://www.sansabacad.org', mailTo: '601 W. Wallace St., San Saba, TX 76877', phone: '325-372-5031' },
  },
  // Schleicher County
  schleicher: {
    cadName: null,
    fileBy: { website: 'https://www.schleichercad.org', mailTo: 'P.O. Box 936, Eldorado, TX 76936-0936', phone: '325-853-2617' },
  },
  // Scurry County
  scurry: {
    cadName: null,
    fileBy: { website: 'https://www.scurrytex.com', mailTo: '2612 College Ave., Snyder, TX 79549-3334', phone: '325-573-8549' },
  },
  // Shackelford County
  shackelford: {
    cadName: null,
    fileBy: { website: 'https://www.shackelfordcad.com', mailTo: 'P.O. Box 2247, Albany, TX 76430-8011', phone: '325-762-2207' },
  },
  // Shelby County
  shelby: {
    cadName: null,
    fileBy: { website: 'https://www.shelbycad.com', mailTo: '724 Shelbyville St., Center, TX 75935-3736', phone: '936-598-6171' },
  },
  // Sherman County
  sherman: {
    cadName: null,
    fileBy: { website: 'https://www.shermancad.org', mailTo: 'P.O. Box 239, Stratford, TX 79084-0239', phone: '806-366-5566' },
  },
  // Smith County
  smith: {
    cadName: 'Smith County Appraisal District',
    fileBy: { website: 'https://www.smithcad.org', mailTo: '245 S. S.E. Loop 323, Tyler, TX 75702-6456', phone: '903-510-8600' },
  },
  // Somervell County
  somervell: {
    cadName: null,
    fileBy: { website: 'https://www.somervellcad.net', mailTo: '112 Allen Dr., Glen Rose, TX 76043-4526', phone: '254-897-4094' },
  },
  // Starr County
  starr: {
    cadName: 'Starr Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.starrcad.org/', website: 'https://starrcad.org', mailTo: '100 N. FM 3167, Ste. 300, Rio Grande City, TX 78582-6211', phone: '956-487-5613' },
  },
  // Stephens County
  stephens: {
    cadName: null,
    fileBy: { website: 'https://www.stephenscad.com', mailTo: 'P.O. Box 351, Breckenridge, TX 76424-0351', phone: '254-559-8233' },
  },
  // Sterling County
  sterling: {
    cadName: null,
    fileBy: { website: 'https://www.sterlingcad.org', mailTo: 'P.O. Box 28, Sterling City, TX 76951-0028', phone: '325-378-7711' },
  },
  // Stonewall County
  stonewall: {
    cadName: null,
    fileBy: { website: 'https://www.stonewallcad.org', mailTo: 'P.O. Box 308, Aspermont, TX 79502-0308', phone: '940-989-3363' },
  },
  // Sutton County
  sutton: {
    cadName: null,
    fileBy: { website: 'https://www.suttoncad.com', mailTo: '300 E. Oak St., Ste. 2, Sonora, TX 76950-2671', phone: '325-387-2809' },
  },
  // Swisher County
  swisher: {
    cadName: null,
    fileBy: { website: 'https://www.swisher-cad.org', mailTo: 'P.O. Box 8, Tulia, TX 79088-0008', phone: '806-995-4118' },
  },
  // Tarrant County
  tarrant: {
    cadName: 'Tarrant Appraisal District',
    fileBy: {
      // Portal confirmed by the district 2026-07-22: account creation / protest
      // filing is at tad.org/account/create (the old www.tad.org/tadqr01 value is
      // just the "Property Tax Protest and Appeal Procedures" INFO page, not a portal).
      efileUrl: 'https://www.tad.org/account/create',
      website: 'https://www.tad.org',
      mailTo: '2500 Handley-Ederville Rd., Fort Worth, TX 76118-6909',
      phone: '817-284-0024',
      // Grounded in tad.org's own protest/online-account pages (2026-07-22).
      evidenceHowTo: 'To see the evidence Tarrant Appraisal District (TAD) used to value your property, log into your TAD dashboard account — if you don’t have one yet, [create your TAD account](https://www.tad.org/account/create) using the Online PIN printed on your Value Notice. Once you’ve filed your protest, you can review the district’s evidence from your dashboard; TAD must make it available to you at least 14 days before your hearing (Texas Tax Code §41.461).',
    },
  },
  // Taylor County
  taylor: {
    cadName: null,
    fileBy: { website: 'https://www.taylor-cad.org', mailTo: 'P.O. Box 1800, Abilene, TX 79604-1800', phone: '325-676-9381' },
  },
  // Terrell County
  terrell: {
    cadName: null,
    fileBy: { website: 'https://www.terrellcad.org', mailTo: 'P.O. Box 747, Sanderson, TX 79848-0747', phone: '432-345-2251' },
  },
  // Terry County
  terry: {
    cadName: 'Terry County Appraisal District',
    fileBy: { website: 'https://terrycoad.org', mailTo: 'P.O. Box 426, Brownfield, TX 79316-0426', phone: '806-637-6966' },
  },
  // Throckmorton County
  throckmorton: {
    cadName: null,
    fileBy: { website: 'https://www.throckmortoncad.org', mailTo: 'P.O. Box 788, Throckmorton, TX 76483-0788', phone: '940-213-1114' },
  },
  // Titus County
  titus: {
    cadName: null,
    fileBy: { website: 'https://www.titus-cad.org', mailTo: 'P.O. Box 528, Mount Pleasant, TX 75456-0528', phone: '903-572-7939' },
  },
  // Tom Green County
  tomgreen: {
    cadName: null,
    fileBy: { website: 'https://www.tomgreencad.com', mailTo: '2302 Pulliam St., San Angelo, TX 76905-5165', phone: '325-658-5575' },
  },
  // Travis County
  travis: {
    cadName: 'Travis Central Appraisal District',
    fileBy: {
      efileUrl: 'https://traviscad.org/efile/',
      website: 'https://traviscad.org',
      mailTo: 'P.O. Box 149012, Austin, TX 78714-9012',
      phone: '512-834-9317',
      // Verified 2026-07-22 against traviscad.org/protests + /arbhearings.
      evidenceHowTo: "To see the evidence Travis Central Appraisal District (TCAD) used to value your property, log into your [TCAD online account](https://traviscad.org) using the property owner ID and PIN from your Notice of Appraised Value. Once you've filed your protest, TCAD's evidence packet is available in the portal; you may also inspect it at the district office starting 14 days before your hearing (Texas Tax Code §41.461).",
    },
  },
  // Trinity County
  trinity: {
    cadName: null,
    fileBy: { website: 'https://trinitycad.net', mailTo: 'P.O. Box 950, Groveton, TX 75845-0950', phone: '936-642-1502' },
  },
  // Tyler County
  tyler: {
    cadName: null,
    fileBy: { website: 'https://www.tylercad.net', mailTo: 'P.O. Drawer 9, Woodville, TX 75979-0009', phone: '409-283-3736' },
  },
  // Upshur County
  upshur: {
    cadName: null,
    fileBy: { website: 'https://www.upshur-cad.org', mailTo: '105 Diamond Loch Rd., Gilmer, TX 75644-9372', phone: '903-843-3041' },
  },
  // Upton County
  upton: {
    cadName: null,
    fileBy: { website: 'https://www.uptoncad.org', mailTo: 'P.O. Box 1110, McCamey, TX 79752-1110', phone: '432-652-3221' },
  },
  // Uvalde County
  uvalde: {
    cadName: null,
    fileBy: { website: 'https://www.uvaldecad.org', mailTo: '209 N. High St., Uvalde, TX 78801-5207', phone: '830-278-1106' },
  },
  // Val Verde County
  valverde: {
    cadName: 'Val Verde County Appraisal District',
    fileBy: { website: 'https://www.valverdecad.org', mailTo: '417 W. Cantu Rd., Del Rio, TX 78840-3049', phone: '830-774-4602' },
  },
  // Van Zandt County
  vanzandt: {
    cadName: 'Van Zandt County Appraisal District',
    fileBy: { website: 'https://vzcad.org', mailTo: 'P.O. Box 926, Canton, TX 75103-0926', phone: '903-567-6171' },
  },
  // Victoria County
  victoria: {
    cadName: 'Victoria Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.victoriacad.org/', website: 'https://victoriacad.org', mailTo: '2805 N. Navarro St., Ste. 300, Victoria, TX 77901-3947', phone: '361-576-3621' },
  },
  // Walker County
  walker: {
    cadName: 'Walker County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.walkercad.org/', website: 'https://walkercad.org', mailTo: 'P.O. Box 1798, Huntsville, TX 77342-1798', phone: '936-295-0402' },
  },
  // Waller County
  waller: {
    cadName: 'Waller County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.waller-cad.org/', website: 'https://waller-cad.org', mailTo: 'P.O. Box 887, Hempstead, TX 77445-0887', phone: '979-921-0060' },
  },
  // Ward County
  ward: {
    cadName: null,
    fileBy: { website: 'https://www.wardcad.org', mailTo: 'P.O. Box 905, Monahans, TX 79756-0905', phone: '432-943-3224' },
  },
  // Washington County
  washington: {
    cadName: null,
    fileBy: { website: 'https://www.washingtoncad.org', mailTo: 'P.O. Box 681, Brenham, TX 77834-0681', phone: '979-277-3740' },
  },
  // Webb County
  webb: {
    cadName: null,
    fileBy: { website: 'https://www.webbcad.org', mailTo: '3302 Clark Blvd., Laredo, TX 78043-3346', phone: '956-718-4091' },
  },
  // Wharton County
  wharton: {
    cadName: null,
    fileBy: { website: 'https://www.whartoncad.net', mailTo: '308 E. Milam St., Wharton, TX 77488-4918', phone: '979-532-8931' },
  },
  // Wheeler County
  wheeler: {
    cadName: null,
    fileBy: { website: 'https://www.wheelercad.org', mailTo: 'P.O. Box 1200, Wheeler, TX 79096-1200', phone: '806-826-5900' },
  },
  // Wichita County
  wichita: {
    cadName: 'Wichita Appraisal District',
    fileBy: { efileUrl: 'https://portal.wadtx.com/', website: 'https://wadtx.com', mailTo: 'P.O. Box 5172, Wichita Falls, TX 76307-5172', phone: '940-322-2435' },
  },
  // Wilbarger County
  wilbarger: {
    cadName: null,
    fileBy: { website: 'https://www.wilbargerappraisal.org', mailTo: 'P.O. Box 1519, Vernon, TX 76384-1519', phone: '940-553-1857' },
  },
  // Willacy County
  willacy: {
    cadName: null,
    fileBy: { website: 'https://www.willacycad.org', mailTo: '688 FM 3168, Raymondville, TX 78580', phone: '956-689-5979' },
  },
  // Williamson County
  williamson: {
    cadName: 'Williamson Central Appraisal District',
    fileBy: { efileUrl: 'https://www.wcad.org/online-protest-filing/', website: 'https://www.wcad.org', mailTo: '625 FM 1460, Georgetown, TX 78626-8050', phone: '512-930-3787' },
  },
  // Wilson County
  wilson: {
    cadName: null,
    fileBy: { website: 'https://wilson-cad.org', mailTo: '1611 Railroad St., Floresville, TX 78114-1825', phone: '830-393-3065' },
  },
  // Winkler County
  winkler: {
    cadName: null,
    fileBy: { website: 'https://www.winklercad.org', mailTo: 'P.O. Box 1219, Kermit, TX 79745-1219', phone: '432-586-2832' },
  },
  // Wise County
  wise: {
    cadName: 'Wise County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.wise-cad.com/', website: 'https://wise-cad.com', mailTo: '400 E. Business 380, Decatur, TX 76234-3165', phone: '940-627-3081' },
  },
  // Wood County
  wood: {
    cadName: 'Wood County Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.woodcad.net/', website: 'https://www.woodcad.net', mailTo: 'P.O. Box 1706, Quitman, TX 75783-1706', phone: '903-763-4891' },
  },
  // Yoakum County
  yoakum: {
    cadName: null,
    fileBy: { website: 'https://www.yoakumcad.org', mailTo: 'P.O. Box 748, Plains, TX 79355-0748', phone: '806-456-7101' },
  },
  // Young County
  young: {
    cadName: null,
    fileBy: { mailTo: 'P.O. Box 337, Graham, TX 76450-0337', phone: '940-549-2392' },
  },
  // Zapata County
  zapata: {
    cadName: null,
    fileBy: { website: 'https://zapatacad.com', mailTo: '200 E. 7th Ave., Ste. 240, Zapata, TX 78076-9998', phone: '956-765-9988' },
  },
  // Zavala County
  zavala: {
    cadName: 'Zavala Central Appraisal District',
    fileBy: { efileUrl: 'https://eprotest.zavalacad.com/', website: 'https://zavalacad.com', mailTo: '323 W. Zavala St., Crystal City, TX 78839-3240', phone: '830-374-3475' },
  },
};

/**
 * Resolve a county slug to its filing record. Returns null when the county is
 * not in the registry — the caller should fall back to a generic "find your
 * appraisal district" instruction rather than guess a name.
 */
export function lookupCad(county: string | null | undefined): TxCad | null {
  return TX_CADS[normCounty(county)] ?? null;
}
