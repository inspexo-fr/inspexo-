// src/lib/constants.js — décisions verrouillées. Importer partout, ne pas paraphraser.
export const POSITIONING = 'ai-first';
export const COLORS = { ink:'#0F0E0D', ember:'#E85D2F', gold:'#D4AF7A', cream:'#F4F1EB', smoke:'#B2ACA3' };
export const FONTS = { display:'Syne', body:'Plus Jakarta Sans', mono:'JetBrains Mono' /* OBD/km uniquement */ };
export const EASE = [0.65, 0.005, 0.35, 1];
export const SEQUENCES = [
  { id:'opening',  range:[0.00,0.15] },
  { id:'belt',     range:[0.15,0.65] },
  { id:'lock',     range:[0.65,0.75] }, // explosion = l'IA verrouille (seuil-déclenché)
  { id:'clusters', range:[0.75,1.00] },
];
export const COPY = {
  overline: 'Expertise automobile par l’IA',
  h1: {
    opening:  ['Une voiture d’occasion', 'ne dit jamais tout.'],
    belt:     ['Filmez-la.', 'L’IA voit le reste.'],
    clusters: ['Chaque modèle a ses pannes.', 'L’IA les connaît.'],
  },
  emberWord: { opening:'ne dit jamais tout', belt:'IA', clusters:'IA' }, // mot-clé ember persistant
  sub: {
    belt:     'Détection des défaillances, estimation des réparations, verdict — en minutes.',
    clusters: 'Une intelligence spécialisée par origine. Un expert en visio quand vous voulez un humain.',
  },
  ctaPrimary: 'Analyser ma voiture',
  ctaSecondary: 'Parler à un expert',
  trust: ['Dès 9,90€', 'Expert en visio', 'Côté acheteur uniquement'],
  counter: ['L’ouverture', 'La traversée', 'Le verdict', 'Les spécialistes'],
};
export const TYPE_FX = { perLetterMsOpening:120, perLetterMsRest:60 };
export const TIERS = {
  desktop: { minWidth:1024, instances:128, postfx:['bloom'] },
  tablet:  { minWidth:768,  instances:40,  postfx:['bloom-light'] },
  mobile:  { minWidth:0,    instances:8,   postfx:[] },
};
export const PARTS = ['piston','vilebrequin','amortisseur','engrenage','cle','bougie','disque_frein','puce'];
export const CLUSTERS = [
  { id:'de', label:'Spécialiste allemand',  flag:'🇩🇪', brands:['BMW','Mercedes-Benz','Audi','Porsche','Volkswagen'] },
  { id:'it', label:'Spécialiste italien',   flag:'🇮🇹', brands:['Ferrari','Lamborghini','Alfa Romeo','Maserati','Fiat'] },
  { id:'fr', label:'Spécialiste français',  flag:'🇫🇷', brands:['Renault','Peugeot','Citroën','DS','Dacia'] },
  { id:'jp', label:'Spécialiste japonais',  flag:'🇯🇵', brands:['Toyota','Honda','Nissan','Mazda','Subaru','Mitsubishi','Lexus'] },
  { id:'kr', label:'Spécialiste coréen',    flag:'🇰🇷', brands:['Hyundai','Kia','Genesis'] },
  { id:'us', label:'Spécialiste américain', flag:'🇺🇸', brands:['Ford','Tesla','Cadillac','Dodge','Chevrolet','Jeep'] },
  { id:'uk', label:'Spécialiste anglais',   flag:'🇬🇧', brands:['Land Rover','Jaguar','Mini','Lotus','McLaren','Bentley','Rolls-Royce','Aston Martin'] },
  { id:'emerging', label:'Émergents', flag:null, brands:['BYD','MG','Polestar','Volvo','Cupra'] }, // drapeau noir + cercle ember
];
