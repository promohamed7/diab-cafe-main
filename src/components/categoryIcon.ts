// Website-side presentation only: picks a Material icon for a Café category by
// its name. Café doesn't publish icons; this never affects ordering.

const RULES: ReadonlyArray<[RegExp, string]> = [
  [/بن|حبوب|محمص/, 'grain'],
  [/إيس تي|شاي/, 'emoji_food_beverage'],
  [/إيس|مثلج|بارد/, 'ac_unit'],
  [/تركي|عربي/, 'local_cafe'],
  [/فرنسي/, 'coffee_maker'],
  [/موهيتو/, 'local_bar'],
  [/عصير|عصائر/, 'water_drop'],
  [/سموذي/, 'blender'],
  [/فرابيه|آيس كريم/, 'icecream'],
  [/ميلك|شيك/, 'local_drink'],
  [/حلو|كيك|حلويات/, 'cake'],
  [/إضاف/, 'add_circle'],
  [/ساخن/, 'mug'],
  [/سريع/, 'bolt'],
  [/إسبريسو|قهوة/, 'coffee']
];

export function categoryIcon(name: string): string {
  for (const [re, icon] of RULES) if (re.test(name)) return icon;
  return 'restaurant_menu';
}
