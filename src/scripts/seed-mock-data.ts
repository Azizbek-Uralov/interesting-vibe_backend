import { config } from 'dotenv';
config();

import * as bcrypt from 'bcrypt';
import {
  PrismaClient,
  Roles,
  UserStatus,
  PostStatus,
  MediaType,
  Language,
} from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ==========================================
// 1. KATEGORIYALAR RO'YXATI
// ==========================================
const CATEGORIES = [
  {
    key: 'architecture',
    translations: [
      { language: Language.UZ, name: 'Arxitektura va Interyer', slug: 'arxitektura-va-interyer', description: 'Zamonaviy bino va interyer dizaynlari' },
      { language: Language.EN, name: 'Architecture & Interior', slug: 'architecture-interior', description: 'Modern building and interior designs' },
      { language: Language.RU, name: 'Архитектура и Интерьер', slug: 'arxitektura-i-interer', description: 'Современная архитектура и дизайн интерьера' },
    ],
  },
  {
    key: 'nature-travel',
    translations: [
      { language: Language.UZ, name: 'Tabiat va Sayohat', slug: 'tabiat-va-sayohat', description: 'Tog‘lar, dengizlar va ajoyib manzaralar' },
      { language: Language.EN, name: 'Nature & Travel', slug: 'nature-travel', description: 'Mountains, oceans and scenic landscapes' },
      { language: Language.RU, name: 'Природа и Путешествия', slug: 'priroda-i-puteshestviya', description: 'Горы, океаны и живописные пейзажи' },
    ],
  },
  {
    key: 'technology',
    translations: [
      { language: Language.UZ, name: 'Texnologiya va Ish stoli', slug: 'texnologiya-va-ish-stoli', description: 'Minimalist setup va dasturchilar olami' },
      { language: Language.EN, name: 'Technology & Workspace', slug: 'technology-workspace', description: 'Minimalist setups and tech lifestyle' },
      { language: Language.RU, name: 'Технологии и Рабочее место', slug: 'texnologii-i-rabochee-mesto', description: 'Минималистичные сетапы и технологии' },
    ],
  },
  {
    key: 'culinary',
    translations: [
      { language: Language.UZ, name: 'Pazandalik va Qahva', slug: 'pazandalik-va-qahva', description: 'Mazali taomlar, qahva sanʼati va pishiriqlar' },
      { language: Language.EN, name: 'Culinary & Coffee', slug: 'culinary-coffee', description: 'Delicious foods, latte art and pastries' },
      { language: Language.RU, name: 'Кулинария и Кофе', slug: 'kulinariya-i-kofe', description: 'Вкусные блюда, латте-арт и выпечка' },
    ],
  },
  {
    key: 'urban-street',
    translations: [
      { language: Language.UZ, name: 'Shahar va Ko‘chalar', slug: 'shahar-va-kochalar', description: 'Megapolislar, tungi chiroqlar va shahar hayoti' },
      { language: Language.EN, name: 'Urban & Street', slug: 'urban-street', description: 'Metropolis, night lights and street life' },
      { language: Language.RU, name: 'Город и Улицы', slug: 'gorod-i-ulitsy', description: 'Мегаполисы, огни ночного города и стрит-лайф' },
    ],
  },
  {
    key: 'art-3d',
    translations: [
      { language: Language.UZ, name: 'Raqamli Sanʼat va 3D', slug: 'raqamli-sanat-va-3d', description: 'Abstrakt renderlar, 3D modellar va illyustratsiyalar' },
      { language: Language.EN, name: 'Digital Art & 3D', slug: 'digital-art-3d', description: 'Abstract renders, 3D motion and illustrations' },
      { language: Language.RU, name: 'Цифровое искусство и 3D', slug: 'tsifrovoe-iskusstvo-i-3d', description: 'Абстрактные рендеры, 3D motion и дизайн' },
    ],
  },
];

// ==========================================
// 2. TEGLAR RO'YXATI
// ==========================================
const TAGS = [
  { key: 'architecture', uz: { name: 'Arxitektura', slug: 'arxitektura' }, en: { name: 'Architecture', slug: 'architecture' }, ru: { name: 'Архитектура', slug: 'arkhitektura' } },
  { key: 'interior', uz: { name: 'Interyer', slug: 'interyer' }, en: { name: 'Interior', slug: 'interior' }, ru: { name: 'Интерьер', slug: 'interer' } },
  { key: 'minimalism', uz: { name: 'Minimalizm', slug: 'minimalizm' }, en: { name: 'Minimalism', slug: 'minimalism' }, ru: { name: 'Минимализм', slug: 'minimalizm-ru' } },
  { key: 'nature', uz: { name: 'Tabiat', slug: 'tabiat' }, en: { name: 'Nature', slug: 'nature' }, ru: { name: 'Природа', slug: 'priroda' } },
  { key: 'mountains', uz: { name: 'Tog‘lar', slug: 'toglar' }, en: { name: 'Mountains', slug: 'mountains' }, ru: { name: 'Горы', slug: 'gory' } },
  { key: 'ocean', uz: { name: 'Okean', slug: 'okean' }, en: { name: 'Ocean', slug: 'ocean' }, ru: { name: 'Океан', slug: 'okean-ru' } },
  { key: 'travel', uz: { name: 'Sayohat', slug: 'sayohat' }, en: { name: 'Travel', slug: 'travel' }, ru: { name: 'Путешествия', slug: 'puteshestviya' } },
  { key: 'workspace', uz: { name: 'Ish stoli', slug: 'ish-stoli' }, en: { name: 'Workspace', slug: 'workspace' }, ru: { name: 'Рабочее место', slug: 'rabochee-mesto' } },
  { key: 'developer', uz: { name: 'Dasturchi', slug: 'dasturchi' }, en: { name: 'Developer', slug: 'developer' }, ru: { name: 'Разработчик', slug: 'razrabotchik' } },
  { key: 'coffee', uz: { name: 'Qahva', slug: 'qahva' }, en: { name: 'Coffee', slug: 'coffee' }, ru: { name: 'Кофе', slug: 'kofe' } },
  { key: 'bakery', uz: { name: 'Shirinliklar', slug: 'shirinliklar' }, en: { name: 'Bakery', slug: 'bakery' }, ru: { name: 'Выпечка', slug: 'vypechka' } },
  { key: 'tokyo', uz: { name: 'Tokio', slug: 'tokio' }, en: { name: 'Tokyo', slug: 'tokyo' }, ru: { name: 'Токио', slug: 'tokio-ru' } },
  { key: 'urban', uz: { name: 'Shahar', slug: 'shahar' }, en: { name: 'Urban', slug: 'urban' }, ru: { name: 'Город', slug: 'gorod' } },
  { key: 'digitalart', uz: { name: 'Raqamli Sanʼat', slug: 'raqamli-sanat' }, en: { name: 'Digital Art', slug: 'digital-art' }, ru: { name: 'Диджитал Арт', slug: 'didzhital-art' } },
  { key: '3danimation', uz: { name: '3D Animatsiya', slug: '3d-animatsiya' }, en: { name: '3D Animation', slug: '3d-animation' }, ru: { name: '3D Анимация', slug: '3d-animatsiya-ru' } },
  { key: 'cinematic', uz: { name: 'Kinematik', slug: 'kinematik' }, en: { name: 'Cinematic', slug: 'cinematic' }, ru: { name: 'Синематик', slug: 'sinematik' } },
];

// ==========================================
// 3. MOCK FOYDALANUVCHILAR RO'YXATI (18 ta)
// ==========================================
const USERS = [
  {
    username: 'laylo_arch',
    fullName: 'Laylo Karimova',
    phone: '+998900001001',
    bio: 'Arxitektor va interyer dizayner. Geometriya va yorug‘lik uyg‘unligi ishqibozi ✨',
    isVerified: true,
  },
  {
    username: 'jasur_craft',
    fullName: 'Jasur Rustamov',
    phone: '+998900001002',
    bio: 'Fullstack developer & mechanical keyboard enthusiast 💻 Toshkent',
    isVerified: true,
  },
  {
    username: 'anvar_nature',
    fullName: 'Anvar Qodirov',
    phone: '+998900001003',
    bio: 'Tabiat va peyzaj fotografligi. Dunyo bo‘ylab go‘zallik izlab 🏔️📸',
    isVerified: true,
  },
  {
    username: 'malika_art',
    fullName: 'Malika Aliyeva',
    phone: '+998900001004',
    bio: 'Raqamli illyustratsiya va 3D pastel renderlar. Har kuni yangi ijod 🎨',
    isVerified: true,
  },
  {
    username: 'shahzod_travel',
    fullName: 'Shahzodbek Mahmudov',
    phone: '+998900001005',
    bio: 'Sayohatlar, okean qirg‘oqlari va sayohat videolari 🌊✈️',
    isVerified: false,
  },
  {
    username: 'nodira_interior',
    fullName: 'Nodira Ismoilova',
    phone: '+998900001006',
    bio: 'Skandinavcha va Japandi uslubidagi shinam uylar va yechimlar 🌿',
    isVerified: true,
  },
  {
    username: 'timur_motion',
    fullName: 'Timur Rahimov',
    phone: '+998900001007',
    bio: '3D Animator & Motion designer. Blender / Cinema4D 🎬',
    isVerified: true,
  },
  {
    username: 'kamola_bakes',
    fullName: 'Kamola Yunusova',
    phone: '+998900001008',
    bio: 'Artisanal qahva va fransuz kruassanlari. Estetika oshxonada boshlanadi 🥐☕',
    isVerified: false,
  },
  {
    username: 'aziz_minimal',
    fullName: 'Azizbek Fayzullayev',
    phone: '+998900001009',
    bio: 'Visual artist & Street visualist. Minimalist kompozitsiyalar 📐',
    isVerified: true,
  },
  {
    username: 'diyor_3d',
    fullName: 'Diyorbek Sobirov',
    phone: '+998900001010',
    bio: 'Abstrakt shakllar va 3D vizualizatsiya ustasi. Ranglar sehrgari 🔮',
    isVerified: false,
  },
  {
    username: 'zuhra_escapes',
    fullName: 'Zuhra Normurodova',
    phone: '+998900001011',
    bio: 'Tog‘ yo‘llari, tumanli o‘rmonlar va sokin xilvat go‘shalar 🌲',
    isVerified: true,
  },
  {
    username: 'umid_urban',
    fullName: 'Umidjon Toirov',
    phone: '+998900001012',
    bio: 'Tungi megapolislar, neon nurlar va ko‘cha atmosferasi 🌃',
    isVerified: false,
  },
  {
    username: 'feruza_aesthetic',
    fullName: 'Feruza Ergasheva',
    phone: '+998900001013',
    bio: 'Kundalik estetika, qahva madaniyati va sokin tonglar ☕🕊️',
    isVerified: false,
  },
  {
    username: 'bobur_tech',
    fullName: 'Bobur Mansurov',
    phone: '+998900001014',
    bio: 'Clean desk setups, ergonomics and tech lifestyle 🖥️',
    isVerified: true,
  },
  {
    username: 'nilufar_cozy',
    fullName: 'Nilufar Saidova',
    phone: '+998900001015',
    bio: 'Tabiatdagi gullar, mayin tonglar va ilhom manbalari 🌸',
    isVerified: false,
  },
  {
    username: 'sardor_cinematic',
    fullName: 'Sardorbek Vohidov',
    phone: '+998900001016',
    bio: 'Cinematography & Short Visual Reels. Kadr ortidagi hikoyalar 🎥',
    isVerified: true,
  },
  {
    username: 'madina_pastel',
    fullName: 'Madina Xamidova',
    phone: '+998900001017',
    bio: 'Arxitektura detallari va fasad geometriyasi 🏛️',
    isVerified: false,
  },
  {
    username: 'alisher_visual',
    fullName: 'Alisher Zokirov',
    phone: '+998900001018',
    bio: 'Visual Creator & Storyteller. Sifatli kontent yaratuvchisi 💡',
    isVerified: true,
  },
];

// ==========================================
// 4. MAVJUD 16 TA MEDIA FAYL REESTRI
// ==========================================
export interface MockMediaDef {
  storageKey: string;
  type: MediaType;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fileSize: bigint;
}

const MEDIA: Record<string, MockMediaDef> = {
  imgArch01: {
    storageKey: 'mock-img-arch-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1440,
    fileSize: BigInt(132967),
  },
  imgArch02: {
    storageKey: 'mock-img-arch-02.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    fileSize: BigInt(298828),
  },
  imgNature01: {
    storageKey: 'mock-img-nature-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    fileSize: BigInt(338050),
  },
  imgNature02: {
    storageKey: 'mock-img-nature-02.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    fileSize: BigInt(181899),
  },
  imgNature03: {
    storageKey: 'mock-img-nature-03.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    fileSize: BigInt(365306),
  },
  imgTech01: {
    storageKey: 'mock-img-tech-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1280,
    fileSize: BigInt(263268),
  },
  imgTech02: {
    storageKey: 'mock-img-tech-02.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    fileSize: BigInt(273817),
  },
  imgFood01: {
    storageKey: 'mock-img-food-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    fileSize: BigInt(166892),
  },
  imgFood02: {
    storageKey: 'mock-img-food-02.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1080,
    fileSize: BigInt(444761),
  },
  imgUrban01: {
    storageKey: 'mock-img-urban-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1440,
    fileSize: BigInt(550316),
  },
  imgArt01: {
    storageKey: 'mock-img-art-01.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1080,
    fileSize: BigInt(143060),
  },
  imgArt02: {
    storageKey: 'mock-img-art-02.jpg',
    type: MediaType.IMAGE,
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1350,
    fileSize: BigInt(257277),
  },
  vidWaves01: {
    storageKey: 'mock-video-waves-01.mp4',
    type: MediaType.VIDEO,
    mimeType: 'video/mp4',
    width: 960,
    height: 400,
    durationSeconds: 46,
    fileSize: BigInt(23014356),
  },
  vidEscapes02: {
    storageKey: 'mock-video-escapes-02.mp4',
    type: MediaType.VIDEO,
    mimeType: 'video/mp4',
    width: 960,
    height: 540,
    durationSeconds: 5,
    fileSize: BigInt(1128375),
  },
  vidAnimation03: {
    storageKey: 'mock-video-animation-03.mp4',
    type: MediaType.VIDEO,
    mimeType: 'video/mp4',
    width: 320,
    height: 176,
    durationSeconds: 10,
    fileSize: BigInt(788493),
  },
  vidFun04: {
    storageKey: 'mock-video-fun-04.mp4',
    type: MediaType.VIDEO,
    mimeType: 'video/mp4',
    width: 640,
    height: 480,
    durationSeconds: 6,
    fileSize: BigInt(515198),
  },
};

// ==========================================
// 5. MOCK POSTLAR REESTRI (35 ta POST)
// ==========================================
interface MockPostDef {
  title: string;
  description: string;
  authorUsername: string;
  categoryKey: string;
  tagKeys: string[];
  mediaList: MockMediaDef[];
}

const POSTS: MockPostDef[] = [
  // --- Architecture & Design (6 post) ---
  {
    title: 'Minimalist Oq Interyer va Tabiiy Yorug‘lik',
    description: 'Zamonaviy interyerda bo‘shliq va yorug‘likning uyg‘unligi. Har bir detal xotirjamlik bag‘ishlaydi. #architecture #interior #minimalism',
    authorUsername: 'laylo_arch',
    categoryKey: 'architecture',
    tagKeys: ['architecture', 'interior', 'minimalism'],
    mediaList: [MEDIA.imgArch01],
  },
  {
    title: 'Zamonaviy Geometrik Osmono‘par Bino Fasadi',
    description: 'Shahar markazidagi zamonaviy meʼmorchilik durdonasi. Qatʼiy chiziqlar va samoviy akslar. #architecture #interior #urban',
    authorUsername: 'madina_pastel',
    categoryKey: 'architecture',
    tagKeys: ['architecture', 'interior', 'urban'],
    mediaList: [MEDIA.imgArch02],
  },
  {
    title: 'Arxitektura va Bo‘shliq Falsafasi',
    description: 'Devorlar va derazalardan tushayotgan mayin soya. Uyda osoyishtalik yaratish sirlari. #interior #minimalism',
    authorUsername: 'nodira_interior',
    categoryKey: 'architecture',
    tagKeys: ['interior', 'minimalism'],
    mediaList: [MEDIA.imgArch01, MEDIA.imgArch02],
  },
  {
    title: 'Fasad Dizaynidagi Monoxrom Geometriya',
    description: 'Oddiylik ortidagi mukammallik. Shahar osmono‘par binolarining zamonaviy fasad yechimlari. #architecture #minimalism',
    authorUsername: 'aziz_minimal',
    categoryKey: 'architecture',
    tagKeys: ['architecture', 'minimalism'],
    mediaList: [MEDIA.imgArch02],
  },
  {
    title: 'Yorug‘lik Bilan To‘ldirilgan Xonadon',
    description: 'Tabiiy quyosh nuri har qanday xonaga hayot va iliqlik bag‘ishlaydi. #interior #architecture',
    authorUsername: 'laylo_arch',
    categoryKey: 'architecture',
    tagKeys: ['interior', 'architecture'],
    mediaList: [MEDIA.imgArch01],
  },
  {
    title: 'Arxitektura Portfoliosi: Perspektiva',
    description: 'Pastdan yuqoriga qarash. Simmetriya va osmon bilan uchrashuv. #architecture #urban',
    authorUsername: 'madina_pastel',
    categoryKey: 'architecture',
    tagKeys: ['architecture', 'urban'],
    mediaList: [MEDIA.imgArch02],
  },

  // --- Nature & Travel (8 post) ---
  {
    title: 'Yosemite Vodiysida Oltin Quyosh Botishi',
    description: 'Tog‘lar uzra quyosh botishining sehrli lahzalari. Tabiatning eng betakror mo‘jizasi. #nature #mountains #travel',
    authorUsername: 'anvar_nature',
    categoryKey: 'nature-travel',
    tagKeys: ['nature', 'mountains', 'travel'],
    mediaList: [MEDIA.imgNature01],
  },
  {
    title: 'Zumrad Okean Qirg‘og‘i va Oltin Qumlar',
    description: 'Sokin dengiz epkini va moviy suvlar. Dam olish va ilhom olish uchun ajoyib maskan. #ocean #travel #nature',
    authorUsername: 'shahzod_travel',
    categoryKey: 'nature-travel',
    tagKeys: ['ocean', 'travel', 'nature'],
    mediaList: [MEDIA.imgNature02],
  },
  {
    title: 'Tumanli Alpine Qarag‘ay O‘rmoni',
    description: 'Ertalabki toza tog‘ havosi, sokin tuman va moviy archalar. Qalb uchun xotirjamlik. #nature #mountains #travel',
    authorUsername: 'zuhra_escapes',
    categoryKey: 'nature-travel',
    tagKeys: ['nature', 'mountains', 'travel'],
    mediaList: [MEDIA.imgNature03],
  },
  {
    title: 'Majestic Okean To‘lqinlari va Dengiz Jonivorlari',
    description: 'Okean qaʼridagi ulug‘vor to‘lqinlar va marjon qoyalari. To‘liq video lavhani tomosha qiling! 🌊 #ocean #cinematic #nature',
    authorUsername: 'sardor_cinematic',
    categoryKey: 'nature-travel',
    tagKeys: ['ocean', 'cinematic', 'nature'],
    mediaList: [MEDIA.vidWaves01],
  },
  {
    title: 'Bog‘dagi Gullar va Kapalak Raqsi',
    description: 'Bahoriy nafosat. Gul ustiga qo‘ngan nozik kapalak va mayin shamol. Qisqa video loop. 🌸🦋 #nature #travel',
    authorUsername: 'nilufar_cozy',
    categoryKey: 'nature-travel',
    tagKeys: ['nature', 'travel'],
    mediaList: [MEDIA.vidEscapes02],
  },
  {
    title: 'Tog‘ Cho‘qqilari va Ochiq Ufq',
    description: 'Balandlikdan qaraganda dunyo yanada go‘zal ko‘rinadi. Sayohat kundaligidan. #mountains #nature #travel',
    authorUsername: 'anvar_nature',
    categoryKey: 'nature-travel',
    tagKeys: ['mountains', 'nature', 'travel'],
    mediaList: [MEDIA.imgNature01],
  },
  {
    title: 'Tropik Qirg‘oqda Quyoshli Kun',
    description: 'Toza suv, oppoq qum va moviy osmon. Sayohat uchun eng yaxshi manzil. #ocean #travel',
    authorUsername: 'shahzod_travel',
    categoryKey: 'nature-travel',
    tagKeys: ['ocean', 'travel'],
    mediaList: [MEDIA.imgNature02],
  },
  {
    title: 'O‘rmon Ichidagi Sehrli Yo‘lak',
    description: 'Qarag‘ayzor oralab sayr qilish charchoqni bir zumda unutdiradi. #nature #mountains',
    authorUsername: 'zuhra_escapes',
    categoryKey: 'nature-travel',
    tagKeys: ['nature', 'mountains'],
    mediaList: [MEDIA.imgNature03],
  },

  // --- Technology & Workspace (6 post) ---
  {
    title: 'Zamonaviy Dasturchi Ish Stoli — Minimalist Setup',
    description: 'Toza ish maydoni samaradorlikni ikki barobar oshiradi. Mac va tabiiy yorug‘lik uyg‘unligi. #developer #workspace #minimalism',
    authorUsername: 'jasur_craft',
    categoryKey: 'technology',
    tagKeys: ['developer', 'workspace', 'minimalism'],
    mediaList: [MEDIA.imgTech01],
  },
  {
    title: 'Nordic Uslubidagi Klaviaturasi Bor Ish Stoli',
    description: 'Mexanik klaviatura, shinam sichqoncha koveri va qulay stol. Har bir kod yozish zavq keltiradi. #workspace #developer',
    authorUsername: 'bobur_tech',
    categoryKey: 'technology',
    tagKeys: ['workspace', 'developer'],
    mediaList: [MEDIA.imgTech02],
  },
  {
    title: 'Mening Kundalik Ish Maydonim (Desk Tour)',
    description: 'Ko‘p vaqtimni shu yerda kod yozish va yangi loyihalar ustida ishlash bilan o‘tkazaman. #workspace #minimalism',
    authorUsername: 'jasur_craft',
    categoryKey: 'technology',
    tagKeys: ['workspace', 'minimalism'],
    mediaList: [MEDIA.imgTech01, MEDIA.imgTech02],
  },
  {
    title: 'Dasturchilar Uchun Ergonomika va Dizayn',
    description: 'Qulaylik va tartib — diqqatni jamlashning birinchi sharti. #developer #workspace',
    authorUsername: 'bobur_tech',
    categoryKey: 'technology',
    tagKeys: ['developer', 'workspace'],
    mediaList: [MEDIA.imgTech02],
  },
  {
    title: 'Kechki Coding Sessiyasi Uchun Muhit',
    description: 'Yumshoq chiroq nuri va yaxshi musiqa jo‘rligida frontend ustida ishlash. #developer #minimalism',
    authorUsername: 'alisher_visual',
    categoryKey: 'technology',
    tagKeys: ['developer', 'minimalism'],
    mediaList: [MEDIA.imgTech01],
  },
  {
    title: 'Minimalist Texnologik Muhit',
    description: 'Stolda faqat eng zarur jihozlar. Ortiqcha simlar va chalg‘ituvchi narsalarsiz. #workspace',
    authorUsername: 'jasur_craft',
    categoryKey: 'technology',
    tagKeys: ['workspace'],
    mediaList: [MEDIA.imgTech02],
  },

  // --- Culinary & Coffee (5 post) ---
  {
    title: 'Seramika Piyoladagi Mukammal Latte Art',
    description: 'Ertalabki qahva nafaqat quvvat, balki estetik zavq manbai hamdir. Barista sanʼati. #coffee #minimalism',
    authorUsername: 'kamola_bakes',
    categoryKey: 'culinary',
    tagKeys: ['coffee', 'minimalism'],
    mediaList: [MEDIA.imgFood01],
  },
  {
    title: 'Yangi Pishgan Fransuz Kruassanlari va Espresso',
    description: 'Qarsildoq qatlamlar, mayin sariyog‘ isi va issiq espresso. Mukammal nonushta. 🥐☕ #bakery #coffee',
    authorUsername: 'feruza_aesthetic',
    categoryKey: 'culinary',
    tagKeys: ['bakery', 'coffee'],
    mediaList: [MEDIA.imgFood02],
  },
  {
    title: 'Tonggi Qahva Marosimi',
    description: 'Kunni xushbo‘y qahva bilan boshlash — har kuni o‘zingizga beradigan kichik sovg‘a. #coffee #bakery',
    authorUsername: 'kamola_bakes',
    categoryKey: 'culinary',
    tagKeys: ['coffee', 'bakery'],
    mediaList: [MEDIA.imgFood01, MEDIA.imgFood02],
  },
  {
    title: 'Kofe Sevuvchilar Uchun Retseptlar',
    description: 'Yaxshi sut ko‘pigi va to‘g‘ri qovurilgan donlar siri haqida. #coffee',
    authorUsername: 'feruza_aesthetic',
    categoryKey: 'culinary',
    tagKeys: ['coffee'],
    mediaList: [MEDIA.imgFood01],
  },
  {
    title: 'Pishiriqlar Sanʼati va Nonvoyxona Estetikasi',
    description: 'Har tong yangi pishirilgan xamir hididan yaxshiroq narsa bormi? #bakery #coffee',
    authorUsername: 'kamola_bakes',
    categoryKey: 'culinary',
    tagKeys: ['bakery', 'coffee'],
    mediaList: [MEDIA.imgFood02],
  },

  // --- Urban & Street (5 post) ---
  {
    title: 'Tokio Ko‘chalarida Yomg‘ir va Tungi Neon',
    description: 'Yomg‘irli ko‘chalardagi rang-barang neon akslari. Tungi Shinjuku manzarasi. 🌧️🏮 #tokyo #urban #cinematic',
    authorUsername: 'umid_urban',
    categoryKey: 'urban-street',
    tagKeys: ['tokyo', 'urban', 'cinematic'],
    mediaList: [MEDIA.imgUrban01],
  },
  {
    title: 'Minimalist Motion Tipografiya va Shahar Dinamikasi',
    description: 'Zamonaviy shahar ritmi va qisqa harakatlar vizualizatsiyasi. Kinetik dizayn namunasi. #urban #cinematic',
    authorUsername: 'sardor_cinematic',
    categoryKey: 'urban-street',
    tagKeys: ['urban', 'cinematic'],
    mediaList: [MEDIA.vidFun04],
  },
  {
    title: 'Kechki Megapolis Ruhiyati',
    description: 'Yuzlab chiroqlar, shoshilayotgan odamlar va tungi shahar nafas olishi. #urban #tokyo',
    authorUsername: 'umid_urban',
    categoryKey: 'urban-street',
    tagKeys: ['urban', 'tokyo'],
    mediaList: [MEDIA.imgUrban01],
  },
  {
    title: 'Ko‘cha Fotografligi: Kadrlar va Soyalar',
    description: 'Shaharning kundalik lahzalarini sanʼatga aylantirish. #urban #minimalism',
    authorUsername: 'aziz_minimal',
    categoryKey: 'urban-street',
    tagKeys: ['urban', 'minimalism'],
    mediaList: [MEDIA.imgUrban01],
  },
  {
    title: 'Veb va Mobil Uchun Qisqa Motion Loop',
    description: 'Interaktiv vizual animatsiya qisqa video formati. #cinematic #urban',
    authorUsername: 'sardor_cinematic',
    categoryKey: 'urban-street',
    tagKeys: ['cinematic', 'urban'],
    mediaList: [MEDIA.vidFun04],
  },

  // --- Digital Art & 3D (5 post) ---
  {
    title: 'Abstrakt 3D Suyuqlik Shakllari va Pastel Gradiyent',
    description: 'Yumshoq pastel ranglar va oquvchi shakllar uyg‘unligi. Zamonaviy 3D sanʼat. #digitalart #minimalism',
    authorUsername: 'malika_art',
    categoryKey: 'art-3d',
    tagKeys: ['digitalart', 'minimalism'],
    mediaList: [MEDIA.imgArt01],
  },
  {
    title: 'Galereya Yorug‘ligidagi Minimalist Skulptura',
    description: 'Zamonaviy shakllar va nafis tekstura. Muzey muhiti va yorug‘lik o‘yini. #digitalart',
    authorUsername: 'diyor_3d',
    categoryKey: 'art-3d',
    tagKeys: ['digitalart'],
    mediaList: [MEDIA.imgArt02],
  },
  {
    title: 'Quvnoq Qahramon 3D Animatsion Loop',
    description: 'Blenderda yaratilgan quvnoq xarakter animatsiyasi. Bolalarcha samimiyat va harakat. 🐰🎬 #3danimation #digitalart',
    authorUsername: 'timur_motion',
    categoryKey: 'art-3d',
    tagKeys: ['3danimation', 'digitalart'],
    mediaList: [MEDIA.vidAnimation03],
  },
  {
    title: 'Raqamli Shakllar va Kompozitsiya',
    description: '3D dizaynda materiallar, yaltiroqlik va rang kontrastlarini izlash. #digitalart',
    authorUsername: 'malika_art',
    categoryKey: 'art-3d',
    tagKeys: ['digitalart'],
    mediaList: [MEDIA.imgArt01, MEDIA.imgArt02],
  },
  {
    title: 'Kelajak Sanʼati: 3D Haykaltaroshlik',
    description: 'Raqamli makonda shakl va hajm yaratish sanʼati. Har bir burchak alohida kompozitsiya. #digitalart #3danimation',
    authorUsername: 'diyor_3d',
    categoryKey: 'art-3d',
    tagKeys: ['digitalart', '3danimation'],
    mediaList: [MEDIA.imgArt02],
  },
];

async function main() {
  console.log('=== SEED MOCK DATA BOSHLANDI ===\n');

  // 1. Superadminni tekshirish (unga tegmaslik kafolati)
  const superadmin = await prisma.user.findFirst({
    where: { role: Roles.SUPERADMIN },
  });
  console.log(`[Xavfsizlik] Superadmin aniqlandi: ${superadmin?.username} (${superadmin?.id}) — Unga tegmaymiz.`);

  // 2. Kategoriyalarni yaratish/yangilash (idempotent)
  console.log('\n[1/4] Kategoriyalar yaratilmoqda...');
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    // Kategoriya mavjudligini UZ slug bo‘yicha tekshirish
    const uzTrans = cat.translations.find((t) => t.language === Language.UZ)!;
    const existingTrans = await prisma.categoryTranslation.findUnique({
      where: {
        language_slug: {
          language: Language.UZ,
          slug: uzTrans.slug,
        },
      },
      include: { category: true },
    });

    let catId = existingTrans?.categoryId;
    if (!existingTrans) {
      const created = await prisma.category.create({
        data: {
          isActive: true,
          translations: {
            create: cat.translations.map((t) => ({
              language: t.language,
              name: t.name,
              slug: t.slug,
              description: t.description,
            })),
          },
        },
      });
      catId = created.id;
      console.log(`  + Yangi kategoriya: ${cat.key} (ID: ${catId})`);
    } else {
      console.log(`  = Kategoriya mavjud: ${cat.key}`);
    }
    categoryMap.set(cat.key, catId!);
  }

  // 3. Teglarni yaratish/yangilash (idempotent)
  console.log('\n[2/4] Teglar yaratilmoqda...');
  const tagMap = new Map<string, string>();
  for (const t of TAGS) {
    const existingTrans = await prisma.tagTranslation.findUnique({
      where: {
        language_slug: {
          language: Language.EN,
          slug: t.en.slug,
        },
      },
      include: { tag: true },
    });

    let tagId = existingTrans?.tagId;
    if (!existingTrans) {
      const created = await prisma.tag.create({
        data: {
          translations: {
            create: [
              { language: Language.UZ, name: t.uz.name, slug: t.uz.slug },
              { language: Language.EN, name: t.en.name, slug: t.en.slug },
              { language: Language.RU, name: t.ru.name, slug: t.ru.slug },
            ],
          },
        },
      });
      tagId = created.id;
      console.log(`  + Yangi teg: #${t.key} (ID: ${tagId})`);
    } else {
      console.log(`  = Teg mavjud: #${t.key}`);
    }
    tagMap.set(t.key, tagId!);
  }

  // 4. Mock foydalanuvchilarni yaratish (18 ta user, idempotent)
  console.log('\n[3/4] Mock foydalanuvchilar yaratilmoqda...');
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);
  const userMap = new Map<string, string>();

  for (const u of USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: u.username },
    });

    let userId = existing?.id;
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          username: u.username,
          fullName: u.fullName,
          phone: u.phone,
          bio: u.bio,
          password: defaultPasswordHash,
          role: Roles.USER,
          status: UserStatus.ACTIVE,
          isVerified: u.isVerified,
          preferredLanguage: Language.UZ,
        },
      });
      userId = created.id;
      console.log(`  + Yangi foydalanuvchi: @${u.username} (${u.fullName})`);
    } else {
      console.log(`  = Foydalanuvchi mavjud: @${u.username}`);
    }
    userMap.set(u.username, userId!);
  }

  // 5. Mock postlarni yaratish (35 ta post, idempotent)
  console.log('\n[4/4] Mock postlar yaratilmoqda...');
  let createdPostsCount = 0;
  let existingPostsCount = 0;

  for (let i = 0; i < POSTS.length; i++) {
    const postDef = POSTS[i];
    const userId = userMap.get(postDef.authorUsername);
    const categoryId = categoryMap.get(postDef.categoryKey);

    if (!userId || !categoryId) {
      console.warn(`  ! User (${postDef.authorUsername}) yoki Kategoriya (${postDef.categoryKey}) topilmadi, o‘tkazib yuborildi.`);
      continue;
    }

    // Idempotentlik tekshiruvi: ushbu user ushbu title bilan post yaratganmi?
    const existingPost = await prisma.post.findFirst({
      where: {
        userId,
        title: postDef.title,
      },
      include: { media: true },
    });

    if (existingPost) {
      existingPostsCount++;
      console.log(`  = Post mavjud (${existingPostsCount}): "${postDef.title.slice(0, 30)}..."`);
      continue;
    }

    // Post yaratish
    const publishDate = new Date(Date.now() - (POSTS.length - i) * 7200000); // Har 2 soat oraliq bilan
    await prisma.post.create({
      data: {
        userId,
        categoryId,
        title: postDef.title,
        description: postDef.description,
        status: PostStatus.PUBLISHED,
        publishedAt: publishDate,
        createdAt: publishDate,
        updatedAt: publishDate,
        media: {
          create: postDef.mediaList.map((m, pos) => ({
            type: m.type,
            storageKey: m.storageKey,
            mimeType: m.mimeType,
            width: m.width ?? null,
            height: m.height ?? null,
            durationSeconds: m.durationSeconds ?? null,
            fileSize: m.fileSize,
            position: pos,
          })),
        },
        tags: {
          create: postDef.tagKeys
            .map((tKey) => {
              const tagId = tagMap.get(tKey);
              return tagId ? { tagId } : null;
            })
            .filter((t): t is { tagId: string } => t !== null),
        },
      },
    });

    createdPostsCount++;
    console.log(`  + Post yaratildi (${createdPostsCount}/${POSTS.length}): "${postDef.title.slice(0, 35)}..." [${postDef.mediaList.length} media]`);
  }

  // Yakuniy statistika
  const totalUsers = await prisma.user.count();
  const totalPosts = await prisma.post.count();
  const totalCategories = await prisma.category.count();
  const totalTags = await prisma.tag.count();
  const totalMedia = await prisma.postMedia.count();

  console.log('\n==========================================');
  console.log('SEED MUVAFFAQIYATLI YAKUNLANDI!');
  console.log(`Jami Foydalanuvchilar: ${totalUsers} ta`);
  console.log(`Jami Postlar:          ${totalPosts} ta (shulardan 2 tasi Superadminning asl posti)`);
  console.log(`Jami Kategoriyalar:    ${totalCategories} ta`);
  console.log(`Jami Teglar:           ${totalTags} ta`);
  console.log(`Jami Post Media:       ${totalMedia} ta`);
  console.log('==========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed jarayonida xatolik yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
