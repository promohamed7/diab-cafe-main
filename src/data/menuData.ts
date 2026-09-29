import { Category, Product, UserProfile } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'espresso', name: 'إسبريسو', nameEn: 'Espresso', icon: 'coffee' },
  { id: 'turkish', name: 'قهوة تركية', nameEn: 'Turkish Coffee', icon: 'local_cafe' },
  { id: 'french', name: 'قهوة فرنسية', nameEn: 'French Coffee', icon: 'coffee_maker' },
  { id: 'iced-espresso', name: 'إيس إسبريسو', nameEn: 'Iced Espresso', icon: 'ac_unit' },
  { id: 'iced-tea', name: 'إيس تي', nameEn: 'Iced Tea', icon: 'emoji_food_beverage' },
  { id: 'mojito', name: 'موهيتو', nameEn: 'Mojito', icon: 'local_bar' },
  { id: 'fresh-juice', name: 'عصائر طازجة', nameEn: 'Fresh Juice', icon: 'water_drop' },
  { id: 'smoothie', name: 'سموذي', nameEn: 'Smoothie', icon: 'blender' },
  { id: 'hot-drinks', name: 'مشروبات ساخنة', nameEn: 'Hot Drinks', icon: 'mug' },
  { id: 'frappe', name: 'فرابيه', nameEn: 'Frappe', icon: 'icecream' },
  { id: 'milkshake', name: 'ميلك شيك', nameEn: 'Milk Shake', icon: 'local_drink' },
  { id: 'dessert', name: 'حلويات', nameEn: 'Dessert', icon: 'cake' },
  { id: 'adds', name: 'إضافات ومشروبات', nameEn: 'Adds & Extras', icon: 'add_circle' },
  // Roastery Categories
  { id: 'beans-turkish', name: 'بن تركي بليند', nameEn: 'Turkish Beans Blend', isRoastery: true, icon: 'grain' },
  { id: 'beans-single', name: 'بن سنجل أوريجين', nameEn: 'Single Organic Beans', isRoastery: true, icon: 'nature' },
  { id: 'beans-espresso', name: 'بن إسبريسو بليند', nameEn: 'Espresso Beans Blend', isRoastery: true, icon: 'science' },
  { id: 'beans-french', name: 'بن فرنسي ونكهات', nameEn: 'French Beans Blend', isRoastery: true, icon: 'bakery_dining' },
  { id: 'beans-instant', name: 'قهوة سريعة الذوبان', nameEn: 'Instant Coffee', isRoastery: true, icon: 'bolt' },
  { id: 'beans-arabic', name: 'قهوة عربي', nameEn: 'Arabic Coffee', isRoastery: true, icon: 'nest_eco_leaf' }
];

export const PRODUCTS: Product[] = [
  // 1. ESPRESSO
  { id: 101, categoryId: 'espresso', name: 'ريستريتو', nameEn: 'Ristretto', priceCents: 3500, desc: 'شوت إسبريسو مركز ومكثف بنكهة غنية عميقة', inStock: true, tag: 'كلاسيك' },
  { id: 102, categoryId: 'espresso', name: 'إسبريسو', nameEn: 'Espresso', priceCents: 4000, desc: 'جرعة إسبريسو صافية مع كريما ذهبية غنية', inStock: true, tag: 'Signature' },
  { id: 103, categoryId: 'espresso', name: 'إسبريسو كونجو', nameEn: 'Espresso Congo', priceCents: 4500, desc: 'محصول كونغولي عضوي بإيحاءات الشوكولاتة الداكنة (نفد من المحمصة)', inStock: false, tag: 'نفدت الكمية' },
  { id: 104, categoryId: 'espresso', name: 'أمريكانو', nameEn: 'Americano', priceCents: 4500, desc: 'شوت إسبريسو مزدوج ممزوج بالماء الساخن', inStock: true },
  { id: 105, categoryId: 'espresso', name: 'ميكاتو', nameEn: 'Macchiato', priceCents: 4500, desc: 'إسبريسو مغطى ببقعة من رغوة الحليب الحريرية', inStock: true },
  { id: 106, categoryId: 'espresso', name: 'كورتادو', nameEn: 'Cortado', priceCents: 5000, desc: 'نسب متساوية ومثالية من الإسبريسو والحليب المبخر', inStock: true, tag: 'Popular' },
  { id: 107, categoryId: 'espresso', name: 'كابتشينو', nameEn: 'Cappuccino', priceCents: 5500, desc: 'توازن فاخر بين الإسبريسو والحليب ورغوة كثيفة مع رشة كاكاو', inStock: true, tag: 'الأكثر طلباً' },
  { id: 108, categoryId: 'espresso', name: 'فلات وايت', nameEn: 'Flat White', priceCents: 5500, desc: 'دبل ريستريتو مع ميكروفوم ناعم حريري مخملي', inStock: true, tag: 'Artisanal' },
  { id: 109, categoryId: 'espresso', name: 'إسبانيش لاتيه', nameEn: 'Spanish Latte', priceCents: 6000, desc: 'إسبريسو مع حليب مكثف محلى وحليب طازج مبخر', inStock: true, tag: 'الأكثر طلباً' },
  { id: 110, categoryId: 'espresso', name: 'كون بان', nameEn: 'Espresso Con Panna', priceCents: 5000, desc: 'إسبريسو يعلوه طبقة من الكريمة المخفوقة الفاخرة', inStock: true },
  { id: 111, categoryId: 'espresso', name: 'كافيه لاتيه', nameEn: 'Caffè Latte', priceCents: 5500, desc: 'كلاسيك لاتيه ناعم مع رغوة حليب خفيفة حريرية', inStock: true },
  { id: 112, categoryId: 'espresso', name: 'كراميل لاتيه', nameEn: 'Caramel Latte', priceCents: 6000, desc: 'لاتيه ناعم ممزوج بنكهة صوص الكراميل الغني', inStock: true },
  { id: 113, categoryId: 'espresso', name: 'فانيليا لاتيه', nameEn: 'Vanilla Latte', priceCents: 6000, desc: 'لاتيه غني برائحة ونكهة الفانيليا المدغشقرية', inStock: true },
  { id: 114, categoryId: 'espresso', name: 'كوكونت لاتيه', nameEn: 'Coconut Latte', priceCents: 6500, desc: 'مزيج استوائي مميز من الإسبريسو ونكهة حليب جوز الهند', inStock: true },
  { id: 115, categoryId: 'espresso', name: 'سولتد كراميل لاتيه', nameEn: 'Salted Caramel Latte', priceCents: 6500, desc: 'توليفة ساحرة تجمع حلاوة الكراميل مع ذرات الملح البحري', inStock: true, tag: 'Special' },
  { id: 116, categoryId: 'espresso', name: 'بندق لاتيه', nameEn: 'Hazelnut Latte', priceCents: 6000, desc: 'لاتيه غني بنكهة البندق المحمص الفاخر', inStock: true },
  { id: 117, categoryId: 'espresso', name: 'كراميل ميكاتو', nameEn: 'Caramel Macchiato', priceCents: 6500, desc: 'طبقات من الفانيليا والحليب والإسبريسو مع خطوط الكراميل', inStock: true },
  { id: 118, categoryId: 'espresso', name: 'كافيه موكا', nameEn: 'Caffè Mocha', priceCents: 6500, desc: 'إسبريسو ممزوج بالشوكولاتة البلجيكية الغنية والحليب', inStock: true },
  { id: 119, categoryId: 'espresso', name: 'كوكونت موكا', nameEn: 'Coconut Mocha', priceCents: 7000, desc: 'شوكولاتة فاخرة مع إسبريسو ونكهة جوز الهند الاستوائية', inStock: true },
  { id: 120, categoryId: 'espresso', name: 'وايت موكا', nameEn: 'White Mocha', priceCents: 7000, desc: 'إسبريسو ناعم مع صوص الشوكولاتة البيضاء السويسرية', inStock: true },
  { id: 121, categoryId: 'espresso', name: 'بيستاشيو لاتيه', nameEn: 'Pistachio Latte', priceCents: 7500, desc: 'لاتيه فاخر متبل بزبدة الفستق الحلبي الطبيعي (غير متوفر حالياً)', inStock: false, tag: 'نفدت الكمية' },
  { id: 122, categoryId: 'espresso', name: 'بيستاشيو إسبانيش لاتيه', nameEn: 'Pistachio Spanish Latte', priceCents: 8000, desc: 'مزيج استثنائي يجمع الفستق الحلبي مع الإسبانيش لاتيه', inStock: true, tag: 'Chef Choice' },
  { id: 123, categoryId: 'espresso', name: 'لوتس لاتيه', nameEn: 'Lotus Biscoff Latte', priceCents: 7500, desc: 'لاتيه دافئ غني بزبدة وبسكويت اللوتس المكرمل', inStock: true },
  { id: 124, categoryId: 'espresso', name: 'كراميل إسبانيش لاتيه', nameEn: 'Caramel Spanish Latte', priceCents: 7000, desc: 'إسبانيش لاتيه معزز بصوص الكراميل المحمص', inStock: true },
  { id: 125, categoryId: 'espresso', name: 'ستروبيري إسبانيش لاتيه', nameEn: 'Strawberry Spanish Latte', priceCents: 7500, desc: 'طبقات من الفراولة الطازجة مع الحليب المكثف والإسبريسو', inStock: true },

  // 2. TURKISH COFFEE
  { id: 201, categoryId: 'turkish', name: 'قهوة تركي إسبشيال', nameEn: 'Special Turkish Coffee', priceCents: 3500, desc: 'خلطة دياب الإسبشيال الخاصة بوش كريمي متماسك (سادة أو محوج)', inStock: true, tag: 'تراث دياب' },
  { id: 202, categoryId: 'turkish', name: 'قهوة تركي جولد بليند', nameEn: 'Gold Blend Turkish', priceCents: 4000, desc: 'توليفة منتقاة من حبوب القهوة الذهبية الفاخرة (سادة ومحوج)', inStock: true, tag: 'Gold' },
  { id: 203, categoryId: 'turkish', name: 'قهوة تركي أرابيكا بليند', nameEn: 'Arabica Blend Turkish', priceCents: 4000, desc: '100% أرابيكا ناعمة بمذاق متوازن وحمضية لطيفة (سادة ومحوج)', inStock: true },
  { id: 204, categoryId: 'turkish', name: 'قهوة تركي كولومبي', nameEn: 'Colombian Turkish', priceCents: 4500, desc: 'بن كولومبي جبلي ذو قوام حريري ونكهة كراميلية (سادة ومحوج)', inStock: true, tag: 'Single Origin' },
  { id: 205, categoryId: 'turkish', name: 'قهوة تركي يمني', nameEn: 'Yemeni Mocha Turkish', priceCents: 5000, desc: 'بن يمني أصيل ذو عبق تاريخي وإيحاءات الفواكه المجففة (نفد المحصول النادر)', inStock: false, tag: 'نفدت الكمية' },
  { id: 206, categoryId: 'turkish', name: 'قهوة تركي برازيلي', nameEn: 'Brazilian Santos Turkish', priceCents: 3500, desc: 'بن برازيلي سانتوس غني بنكهات الجوز والكاكاو (سادة ومحوج)', inStock: true },
  { id: 207, categoryId: 'turkish', name: 'قهوة تركي حبشي', nameEn: 'Ethiopian Habashi Turkish', priceCents: 4500, desc: 'بن إثيوبي مهد القهوة بإيحاءات زهرية وليمونية منعشة (سادة ومحوج)', inStock: true },

  // 3. FRENCH COFFEE
  { id: 301, categoryId: 'french', name: 'قهوة فرنسية كلاسيك', nameEn: 'Classic French Coffee', priceCents: 4500, desc: 'قهوة فرنسية باللبن المبخر والكريمة الغنية', inStock: true },
  { id: 302, categoryId: 'french', name: 'قهوة فرنسية نكهات (بندق / كراميل / فانيليا)', nameEn: 'Flavored French Coffee', priceCents: 5000, desc: 'قهوة فرنسية ناعمة مع اختيارك من النكهات المتاحة', inStock: true, tag: 'Special' },

  // 4. ICED ESPRESSO
  { id: 401, categoryId: 'iced-espresso', name: 'إيس لاتيه', nameEn: 'Iced Latte', priceCents: 5500, desc: 'إسبريسو مثلج منعش مع حليب بارد وطبقة ثلج بلوري', inStock: true },
  { id: 402, categoryId: 'iced-espresso', name: 'إيس كراميل لاتيه', nameEn: 'Iced Caramel Latte', priceCents: 6500, desc: 'لاتيه بارد مع صوص الكراميل المكرمل والثلج', inStock: true },
  { id: 403, categoryId: 'iced-espresso', name: 'إيس إسبانيش لاتيه', nameEn: 'Iced Spanish Latte', priceCents: 6500, desc: 'المشروب البارد المفضل؛ حليب مكثف وإسبريسو طازج مثلج', inStock: true, tag: 'Best Seller' },
  { id: 404, categoryId: 'iced-espresso', name: 'إيس موكا', nameEn: 'Iced Mocha', priceCents: 7000, desc: 'إسبريسو مثلج مع شوكولاتة وحليب بارد وكريمة', inStock: true },
  { id: 405, categoryId: 'iced-espresso', name: 'إيس وايت موكا', nameEn: 'Iced White Mocha', priceCents: 7500, desc: 'شوكولاتة بيضاء مع إسبريسو مثلج وحليب بارد منعش', inStock: true },
  { id: 406, categoryId: 'iced-espresso', name: 'إيس كراميل إسبانيش لاتيه', nameEn: 'Iced Caramel Spanish Latte', priceCents: 7500, desc: 'إسبانيش مثلج مع نكهة ولمسة الكراميل الذهبي', inStock: true },
  { id: 407, categoryId: 'iced-espresso', name: 'إيس ستروبيري إسبانيش لاتيه', nameEn: 'Iced Strawberry Spanish', priceCents: 8000, desc: 'توليفة باردة مبتكرة من بيوريه الفراولة والإسبانيش لاتيه (نفدت الكمية)', inStock: false, tag: 'نفدت الكمية' },
  { id: 408, categoryId: 'iced-espresso', name: 'إيس بندق لاتيه', nameEn: 'Iced Hazelnut Latte', priceCents: 6500, desc: 'لاتيه مثلج مع صوص البندق المحمص الطبيعي', inStock: true },
  { id: 409, categoryId: 'iced-espresso', name: 'إيس أمريكانو', nameEn: 'Iced Americano', priceCents: 5000, desc: 'دبل شوت إسبريسو بارد ومكثف مع مكعبات الثلج', inStock: true },
  { id: 410, categoryId: 'iced-espresso', name: 'إيس كوكونت لاتيه', nameEn: 'Iced Coconut Latte', priceCents: 7000, desc: 'إسبريسو منعش مع نكهة جوز الهند وحليب بارد', inStock: true },
  { id: 411, categoryId: 'iced-espresso', name: 'إيس كوكونت موكا', nameEn: 'Iced Coconut Mocha', priceCents: 7500, desc: 'موكا باردة بنكهة جوز الهند مع صوص الشوكولاتة الداكنة', inStock: true },
  { id: 412, categoryId: 'iced-espresso', name: 'إيس كراميل ميكاتو', nameEn: 'Iced Caramel Macchiato', priceCents: 7000, desc: 'طبقات مثلجة من الحليب والفانيليا وشوت الإسبريسو والكراميل', inStock: true },
  { id: 413, categoryId: 'iced-espresso', name: 'إيس شيكن موكا', nameEn: 'Iced Shaken Mocha', priceCents: 7500, desc: 'مخفوق الإسبريسو مع الثلج والشوكولاتة برغوة غنية', inStock: true },
  { id: 414, categoryId: 'iced-espresso', name: 'إيس شيكن وايت موكا', nameEn: 'Iced Shaken White Mocha', priceCents: 8000, desc: 'مخفوق بالشوكولاتة البيضاء مع رغوة إسبريسو مخملية باردة', inStock: true },
  { id: 415, categoryId: 'iced-espresso', name: 'إيس سولتد كراميل', nameEn: 'Iced Salted Caramel', priceCents: 7000, desc: 'إسبريسو بارد مع صوص الكراميل المملح ولمسة كريمة', inStock: true },

  // 5. ICED TEA
  { id: 501, categoryId: 'iced-tea', name: 'إيس تي بلوبيري', nameEn: 'Blueberry Iced Tea', priceCents: 4500, desc: 'شاي مثلج بنكهة التوت الأزرق المنعش', inStock: true },
  { id: 502, categoryId: 'iced-tea', name: 'إيس تي كرانزوا', nameEn: 'Cranberry Iced Tea', priceCents: 4500, desc: 'شاي مثلج مع مزيج التوت البري الحامض الحلو', inStock: true },
  { id: 503, categoryId: 'iced-tea', name: 'إيس تي فراولة', nameEn: 'Strawberry Iced Tea', priceCents: 4500, desc: 'شاي أسود منقوع ومثلج مع خلاصة الفراولة الطازجة', inStock: true },
  { id: 504, categoryId: 'iced-tea', name: 'إيس تي خوخ', nameEn: 'Peach Iced Tea', priceCents: 4500, desc: 'الشاي المثلج الأشهر بنكهة الخوخ اللذيذة والثلج', inStock: true, tag: 'الأكثر طلباً' },
  { id: 505, categoryId: 'iced-tea', name: 'إيس تي مانجو', nameEn: 'Mango Iced Tea', priceCents: 4500, desc: 'نكهة المانجو الاستوائية مع الشاي المثلج المنعش', inStock: true },
  { id: 506, categoryId: 'iced-tea', name: 'إيس تي كيوي', nameEn: 'Kiwi Iced Tea', priceCents: 4500, desc: 'شاي بارد مع انتعاش الكيوي الأخضر الطبيعي', inStock: true },
  { id: 507, categoryId: 'iced-tea', name: 'إيس تي باشن فروت', nameEn: 'Passion Fruit Iced Tea', priceCents: 5000, desc: 'شاي مثلج بطعم الباشن فروت الاستوائي المميز', inStock: true, tag: 'Tropical' },

  // 6. MOJITO
  { id: 601, categoryId: 'mojito', name: 'موهيتو كلاسيك', nameEn: 'Classic Lime & Mint Mojito', priceCents: 5000, desc: 'صودا منعشة مع النعناع الطازج والليمون والثلج المجروش', inStock: true, tag: 'Classic' },
  { id: 602, categoryId: 'mojito', name: 'موهيتو خوخ', nameEn: 'Peach Mojito', priceCents: 5500, desc: 'موهيتو منعش مع بيوريه الخوخ الطبيعي والنعناع', inStock: true },
  { id: 603, categoryId: 'mojito', name: 'موهيتو كيوي', nameEn: 'Kiwi Mojito', priceCents: 5500, desc: 'انتعاش الكيوي مع الليمون والصودا الفوارة', inStock: true },
  { id: 604, categoryId: 'mojito', name: 'موهيتو مانجو', nameEn: 'Mango Mojito', priceCents: 5500, desc: 'نكهة المانجو الطبيعية مع انتعاش النعناع والليمون', inStock: true },
  { id: 605, categoryId: 'mojito', name: 'موهيتو بطيخ', nameEn: 'Watermelon Mojito', priceCents: 5500, desc: 'انتعاش الصيف مع البطيخ المثلج والصودا', inStock: true, tag: 'Summer Vibes' },
  { id: 606, categoryId: 'mojito', name: 'موهيتو كريز', nameEn: 'Cherry Mojito', priceCents: 5500, desc: 'نكهة الكرز الأحمر الغنية مع صودا الموهيتو المنعشة', inStock: true },
  { id: 607, categoryId: 'mojito', name: 'موهيتو باشن فروت', nameEn: 'Passion Fruit Mojito', priceCents: 6000, desc: 'باشن فروت استوائي مع نعناع وليمون وثلج مجروش', inStock: true, tag: 'Top Choice' },
  { id: 608, categoryId: 'mojito', name: 'موهيتو فراولة', nameEn: 'Strawberry Mojito', priceCents: 5500, desc: 'فراولة طبيعية مهروسة مع النعناع والليمون والصودا', inStock: true },
  { id: 609, categoryId: 'mojito', name: 'موهيتو بلو كوراكاو', nameEn: 'Blue Curaçao Mojito', priceCents: 6000, desc: 'لون أزرق ساحر بنكهة البرتقال والليمون المنعش', inStock: true, tag: 'Signature' },

  // 7. FRESH JUICE
  { id: 701, categoryId: 'fresh-juice', name: 'عصير ليمون طازج', nameEn: 'Fresh Lemon Juice', priceCents: 3500, desc: 'عصير ليمون بلدي طازج معصور على الطلب', inStock: true },
  { id: 702, categoryId: 'fresh-juice', name: 'عصير ليمون نعناع', nameEn: 'Lemon Mint Juice', priceCents: 4000, desc: 'مزيج الليمون والنعناع الأخضر الطازج المنعش', inStock: true, tag: 'Popular' },
  { id: 703, categoryId: 'fresh-juice', name: 'عصير مانجو فريش', nameEn: 'Fresh Mango Juice', priceCents: 5000, desc: 'مانجو طبيعية 100% غنية ومركزة بدون إضافات صناعية', inStock: true },
  { id: 704, categoryId: 'fresh-juice', name: 'عصير فراولة فريش', nameEn: 'Fresh Strawberry Juice', priceCents: 4500, desc: 'فراولة طازجة طبيعية معصورة بعناية', inStock: true },
  { id: 705, categoryId: 'fresh-juice', name: 'عصير كيوي فريش', nameEn: 'Fresh Kiwi Juice', priceCents: 5000, desc: 'عصير كيوي غني بفيتامين C ومنعش للغاية', inStock: true },

  // 8. SMOOTHIE
  { id: 801, categoryId: 'smoothie', name: 'سموذي ليمون', nameEn: 'Lemon Smoothie', priceCents: 4500, desc: 'سموذي ليمون مثلج بقوام ثلجي ناعم', inStock: true },
  { id: 802, categoryId: 'smoothie', name: 'سموذي ليمون نعناع', nameEn: 'Lemon Mint Smoothie', priceCents: 5000, desc: 'سموذي منعش للغاية بقوام كريمي مثلج', inStock: true, tag: 'Favorite' },
  { id: 803, categoryId: 'smoothie', name: 'سموذي مانجو', nameEn: 'Mango Smoothie', priceCents: 5500, desc: 'سموذي مانجو استوائي غني ولذيذ', inStock: true },
  { id: 804, categoryId: 'smoothie', name: 'سموذي فراولة', nameEn: 'Strawberry Smoothie', priceCents: 5000, desc: 'سموذي الفراولة الطازجة المجمدة بقوام مخملي', inStock: true },
  { id: 805, categoryId: 'smoothie', name: 'سموذي كيوي', nameEn: 'Kiwi Smoothie', priceCents: 5500, desc: 'سموذي كيوي مثلج بقوام مخملي حامض حلو', inStock: true },

  // 9. HOT DRINKS
  { id: 901, categoryId: 'hot-drinks', name: 'هوت شوكلت', nameEn: 'Hot Chocolate', priceCents: 5500, desc: 'كاكاو هولندي فاخر مع حليب مبخر ساخن وشوكولاتة بلجيكية', inStock: true, tag: 'Warm & Cozy' },
  { id: 902, categoryId: 'hot-drinks', name: 'هوت شوكلت مارشميلو', nameEn: 'Marshmallow Hot Chocolate', priceCents: 6500, desc: 'هوت شوكلت كريمي مغطى بحبات المارشميلو الذائبة', inStock: true },
  { id: 903, categoryId: 'hot-drinks', name: 'أبل سيدر', nameEn: 'Apple Cider', priceCents: 5000, desc: 'عصير تفاح متبل بالقرفة وعيدان القرنفل الساخنة', inStock: true, tag: 'Seasonal' },
  { id: 904, categoryId: 'hot-drinks', name: 'نسكافيه', nameEn: 'Nescafé Black / Classic', priceCents: 3500, desc: 'قهوة سريعة التحضير ساخنة حسب رغبتك', inStock: true },
  { id: 905, categoryId: 'hot-drinks', name: 'كابتشينو ساخن', nameEn: 'Classic Hot Cappuccino', priceCents: 5500, desc: 'كابتشينو دافئ برغوة وفيرة ورشة قرفة أو شوكولاتة', inStock: true },
  { id: 906, categoryId: 'hot-drinks', name: 'شاي أسود فاخر', nameEn: 'Premium Black Tea', priceCents: 2000, desc: 'شاي أحمر منتقى بعناية مع أوراق النعناع أو سادة', inStock: true },
  { id: 907, categoryId: 'hot-drinks', name: 'شاي أخضر', nameEn: 'Organic Green Tea', priceCents: 2500, desc: 'أوراق الشاي الأخضر الطبيعية المضادة للأكسدة', inStock: true },
  { id: 908, categoryId: 'hot-drinks', name: 'شاي كرك بالحليب', nameEn: 'Traditional Karak Chai', priceCents: 4000, desc: 'شاي مبهر بالهيل والزعفران والحليب المركز على الطريقة الخليجية', inStock: true, tag: 'Authentic' },

  // 10. FRAPPE
  { id: 1001, categoryId: 'frappe', name: 'فرابيه كلاسيك', nameEn: 'Classic Coffee Frappe', priceCents: 6000, desc: 'قهوة مثلجة ممزوجة بالكريمة المخفوقة والثلج', inStock: true },
  { id: 1002, categoryId: 'frappe', name: 'فرابيه كراميل', nameEn: 'Caramel Frappe', priceCents: 6500, desc: 'فرابيه القهوة مع صوص الكراميل والكريمة المخفوقة', inStock: true, tag: 'Popular' },
  { id: 1003, categoryId: 'frappe', name: 'فرابيه موكا', nameEn: 'Mocha Frappe', priceCents: 7000, desc: 'مزيج القهوة والشوكولاتة المثلج مع صوص الكاكاو', inStock: true },
  { id: 1004, categoryId: 'frappe', name: 'فرابيه وايت موكا', nameEn: 'White Mocha Frappe', priceCents: 7500, desc: 'شوكولاتة بيضاء غنية مع قهوة مثلجة وكريمة مخفوقة', inStock: true },
  { id: 1005, categoryId: 'frappe', name: 'فرابيه لوتس', nameEn: 'Lotus Biscoff Frappe', priceCents: 8000, desc: 'فرابيه غني ببسكويت وزبدة اللوتس الشهية', inStock: true, tag: 'Best Seller' },
  { id: 1006, categoryId: 'frappe', name: 'فرابيه كوكونت', nameEn: 'Coconut Frappe', priceCents: 7000, desc: 'نكهة جوز الهند الاستوائية في فرابيه مثلج منعش', inStock: true },
  { id: 1007, categoryId: 'frappe', name: 'فرابيه فانيليا', nameEn: 'Vanilla Frappe', priceCents: 6500, desc: 'كريمة فانيليا مخفوقة مع ثلج وحليب بنكهة ناعمة', inStock: true },
  { id: 1008, categoryId: 'frappe', name: 'فرابيه بندق', nameEn: 'Hazelnut Frappe', priceCents: 7000, desc: 'فرابيه البندق المحمص مع طبقة من الكريمة وصوص البندق', inStock: true },
  { id: 1009, categoryId: 'frappe', name: 'فرابيه أوريو', nameEn: 'Oreo Frappe', priceCents: 7500, desc: 'قطع بسكويت أوريو مقرمشة ممزوجة مع فرابيه الحليب والكريمة', inStock: true, tag: 'Kids & Adults' },

  // 11. MILK SHAKE
  { id: 1101, categoryId: 'milkshake', name: 'ميلك شيك فانيليا', nameEn: 'Vanilla Milkshake', priceCents: 5500, desc: 'آيس كريم فانيليا طبيعي مع حليب كامل الدسم وكريمة', inStock: true },
  { id: 1102, categoryId: 'milkshake', name: 'ميلك شيك شوكولاتة', nameEn: 'Chocolate Milkshake', priceCents: 6000, desc: 'آيس كريم شوكولاتة بلجيكية مع صوص الكاكاو الغني', inStock: true },
  { id: 1103, categoryId: 'milkshake', name: 'ميلك شيك كراميل', nameEn: 'Caramel Milkshake', priceCents: 6000, desc: 'ميلك شيك كريمي بصوص التوفي والكراميل الذهبي', inStock: true },
  { id: 1104, categoryId: 'milkshake', name: 'ميلك شيك أوريو', nameEn: 'Oreo Cookie Shake', priceCents: 6500, desc: 'بسكويت أوريو مخفوق بوفرة مع الآيس كريم والكريمة', inStock: false, tag: 'Top Choice' },
  { id: 1105, categoryId: 'milkshake', name: 'ميلك شيك لوتس', nameEn: 'Lotus Biscoff Shake', priceCents: 7500, desc: 'زبدة لوتس أصلية مع آيس كريم وبودرة البسكويت المقرمش', inStock: true, tag: 'Special' },
  { id: 1106, categoryId: 'milkshake', name: 'ميلك شيك بلوبيري', nameEn: 'Blueberry Milkshake', priceCents: 6500, desc: 'توت أزرق طازج ممزوج بالآيس كريم والكريمة', inStock: true },
  { id: 1107, categoryId: 'milkshake', name: 'ميلك شيك مانجو', nameEn: 'Mango Milkshake', priceCents: 6000, desc: 'مانجو طبيعية مثلجة مع آيس كريم الفانيليا', inStock: true },
  { id: 1108, categoryId: 'milkshake', name: 'ميلك شيك فراولة', nameEn: 'Strawberry Milkshake', priceCents: 6000, desc: 'آيس كريم فراولة غني مع قطع الفراولة وصوص التوت', inStock: true },
  { id: 1109, categoryId: 'milkshake', name: 'ميلك شيك خوخ', nameEn: 'Peach Milkshake', priceCents: 6000, desc: 'ميلك شيك منعش بنكهة الخوخ اللذيذة والآيس كريم', inStock: true },
  { id: 1110, categoryId: 'milkshake', name: 'ميلك شيك كيت كات', nameEn: 'KitKat Milkshake', priceCents: 7500, desc: 'شوكولاتة كيت كات مقرمشة مع آيس كريم وحليب', inStock: true },

  // 12. DESSERT
  { id: 1201, categoryId: 'dessert', name: 'كوكيز فريش', nameEn: 'Fresh Chocolate Chip Cookie', priceCents: 3500, desc: 'كوكيز مقرمشة من الخارج وطرية من الداخل بقطع الشوكولاتة الذائبة', inStock: true, tag: 'Freshly Baked' },
  { id: 1202, categoryId: 'dessert', name: 'تشيز كيك نيويورك', nameEn: 'New York Cheesecake', priceCents: 6500, desc: 'تشيز كيك كريمي أصلي مع صوص التوت البري أو الكراميل أو اللوتس', inStock: true, tag: 'Chef Choice' },
  { id: 1203, categoryId: 'dessert', name: 'مولتن كيك ساخن', nameEn: 'Warm Molten Lava Cake', priceCents: 7000, desc: 'كيك الشوكولاتة بحشوة لافا بركانية دافئة مع بولة آيس كريم', inStock: true, tag: 'Must Try' },
  { id: 1204, categoryId: 'dessert', name: 'فادج براونيز', nameEn: 'Fudge Brownies', priceCents: 5000, desc: 'قطع البراونيز الغنية بقطع الجوز والشوكولاتة الداكنة', inStock: true },
  { id: 1205, categoryId: 'dessert', name: 'تيراميسو إيطالي كلاسيك', nameEn: 'Classic Italian Tiramisu', priceCents: 6500, desc: 'بسكويت سافوياردي مشرب بإسبريسو دياب مع كريمة الماسكاربوني', inStock: true, tag: 'Artisanal' },
  { id: 1206, categoryId: 'dessert', name: 'بنانا سبليت', nameEn: 'Banana Split Sundae', priceCents: 6500, desc: 'موز طازج مع بولات آيس كريم ثلاثية وكريمة مخفوقة ومكسرات', inStock: true },

  // 13. ADDS & EXTRAS
  { id: 1301, categoryId: 'adds', name: 'إضافة صوص أو توبينج فاخر', nameEn: 'Extra Sauce / Topping', priceCents: 1500, desc: 'شوكولاتة، كراميل، وايت موكا، لوتس، أو بيستاشيو', inStock: true },
  { id: 1302, categoryId: 'adds', name: 'إضافة فليفر (سيرب نكهة)', nameEn: 'Flavor Syrup Shot', priceCents: 1500, desc: 'فانيليا، بندق، كراميل، جوز هند، أو قرفة', inStock: true },
  { id: 1303, categoryId: 'adds', name: 'مياه معدنية صغيرة', nameEn: 'Mineral Water (Small)', priceCents: 1000, desc: 'مياه معدنية نقية مثلجة ٥٠٠ مل', inStock: true },
  { id: 1304, categoryId: 'adds', name: 'مشروب طاقة ريدبول', nameEn: 'Red Bull Energy Drink', priceCents: 4500, desc: 'كانز ريدبول الأصلي المنعش', inStock: true },

  // ROASTERY BEANS
  // A. TURKISH BLEND
  { id: 1401, categoryId: 'beans-turkish', name: 'بن كلاسيك سادة', nameEn: 'Classic Plain Turkish Beans', priceCents: 4500, desc: 'توليفة تقليدية متوازنة من حبوب الروبوستا والأرابيكا المعالجة', inStock: true, isRoastery: true, unit: '1/8k', tag: 'تراث دياب' },
  { id: 1402, categoryId: 'beans-turkish', name: 'بن كلاسيك محوج', nameEn: 'Classic Spiced Turkish Beans', priceCents: 5500, desc: 'بن كلاسيك محوج بالهيل الأخضر الفاخر والمستكة وجوزة الطيب', inStock: true, isRoastery: true, unit: '1/8k', tag: 'محوج فاخر' },
  { id: 1403, categoryId: 'beans-turkish', name: 'بن إسبشيال سادة', nameEn: 'Special Plain Turkish Beans', priceCents: 5500, desc: 'توليفة محمصة دياب الخاصة عالية القوام بدون أي إضافات', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Specialty' },
  { id: 1404, categoryId: 'beans-turkish', name: 'بن إسبشيال محوج', nameEn: 'Special Spiced Turkish Beans', priceCents: 6500, desc: 'توليفة دياب الإسبشيال المحوجة بالهيل والزعفران والمستكة التركية', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Signature' },
  { id: 1405, categoryId: 'beans-turkish', name: 'بن جولد بليند سادة', nameEn: 'Gold Blend Plain Beans', priceCents: 6500, desc: 'حبوب منتقاة بعناية بدرجة تحميص ذهبية وسلاسة استثنائية', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Gold Series' },
  { id: 1406, categoryId: 'beans-turkish', name: 'بن جولد بليند محوج', nameEn: 'Gold Blend Spiced Beans', priceCents: 7500, desc: 'جولد بليند محوج بأندر التوابل العطرية وأعواد الهيل الصافي', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Gold Series' },
  { id: 1407, categoryId: 'beans-turkish', name: 'بن أرابيكا سادة 100%', nameEn: '100% Arabica Plain Beans', priceCents: 7000, desc: 'حبوب أرابيكا نقية ناعمة من مرتفعات أمريكا اللاتينية', inStock: true, isRoastery: true, unit: '1/8k', tag: '100% Arabica' },
  { id: 1408, categoryId: 'beans-turkish', name: 'بن أرابيكا محوج 100%', nameEn: '100% Arabica Spiced Beans', priceCents: 8000, desc: 'أرابيكا نقية مع تحويجة ناعمة تبرز حمضية وحلاوة المحصول', inStock: true, isRoastery: true, unit: '1/8k', tag: '100% Arabica' },

  // B. SINGLE ORGANIC ORIGINS
  { id: 1501, categoryId: 'beans-single', name: 'بن كولومبي وسط (سادة ومحوج)', nameEn: 'Colombian Medium Roast', priceCents: 7500, desc: 'محصول كولومبي سوبريمو بإيحاءات الكراميل والمكسرات ولمسة تفاح أحمر', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Supremo' },
  { id: 1502, categoryId: 'beans-single', name: 'بن يمني مطري (سادة ومحوج)', nameEn: 'Yemeni Matari Organic', priceCents: 11000, desc: 'من أقدم مزارع اليمن، نكهة معقدة فاكهية توابلية عميقة لا تضاهى', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Rare Heritage' },
  { id: 1503, categoryId: 'beans-single', name: 'بن برازيلي سانتوس (سادة ومحوج)', nameEn: 'Brazilian Santos Estate', priceCents: 6000, desc: 'قوام شوكولاتي ممتلئ وحمضية منخفضة تناسب مختلف الأذواق', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Single Origin' },
  { id: 1504, categoryId: 'beans-single', name: 'بن حبشي يرجاشيف (سادة ومحوج)', nameEn: 'Ethiopian Yirgacheffe', priceCents: 8000, desc: 'إيحاءات الياسمين وزهر البرتقال والتوت الأزرق العضوي الفاخر', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Organic' },
  { id: 1505, categoryId: 'beans-single', name: 'بن جواتيمالا أنتيجوا (سادة ومحوج)', nameEn: 'Guatemala Antigua', priceCents: 8500, desc: 'محصول بركاني غني بنكهات الدارك شوكليت والبهارات العطرية اللطيفة', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Volcanic Soil' },
  { id: 1506, categoryId: 'beans-single', name: 'بن كيني AA (سادة ومحوج)', nameEn: 'Kenya AA Top Lot', priceCents: 9500, desc: 'تصنيف كيني AA الأعلى جودة بإيحاءات الكشمش الأسود والحمضية المتألقة', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Grade AA' },
  { id: 1507, categoryId: 'beans-single', name: 'بن هندي أرابيكا بلانتيشن (سادة ومحوج)', nameEn: 'Indian Arabica Plantation', priceCents: 6500, desc: 'حبوب أرابيكا هندية جبلية بتوابل خفيفة وقوام كريمي ناعم', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Single Origin' },

  // C. ESPRESSO BLEND
  { id: 1601, categoryId: 'beans-espresso', name: 'هاوس بليند 30/70', nameEn: 'House Blend 30/70', priceCents: 6500, desc: 'التوليفة الرسمية المعتمدة للمشروبات الحليبية في بار دياب كافيه', inStock: true, isRoastery: true, unit: '1/8k', tag: 'House Special' },
  { id: 1602, categoryId: 'beans-espresso', name: 'روما 100% أرابيكا', nameEn: 'Roma 100% Arabica Blend', priceCents: 8500, desc: 'تحميص إيطالي كلاسيكي لإسبريسو نقي غني بالكريمة والنكهات الزيتية العطرية', inStock: true, isRoastery: true, unit: '1/8k', tag: '100% Arabica' },
  { id: 1603, categoryId: 'beans-espresso', name: 'روست كريمي 40/60', nameEn: 'Crema Roast 40/60', priceCents: 6000, desc: 'خلطة متوازنة بكريمة كثيفة تدوم طويلاً لخبراء الإسبريسو', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1604, categoryId: 'beans-espresso', name: 'هامر جيد سترونج بليند', nameEn: 'Hammer Jade Strong Blend', priceCents: 7000, desc: 'توليفة قوية عالية الكافيين بمذاق داكن مدخن لمحبي القوة والنشاط', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Strong Shot' },

  // D. FRENCH BLEND
  { id: 1701, categoryId: 'beans-french', name: 'بن فرنسي كلاسيك', nameEn: 'Classic French Roast Beans', priceCents: 5500, desc: 'حبوب معالجة بمبيض الحليب والمذاق المخملي الفرنسي الأصيل', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1702, categoryId: 'beans-french', name: 'بن فرنسي بندق', nameEn: 'French Hazelnut Beans', priceCents: 6500, desc: 'بن فرنسي مطعم بنكهة زيت البندق البندقي المحمص', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1703, categoryId: 'beans-french', name: 'بن فرنسي بندق قطع مكسرات', nameEn: 'French Hazelnut Chunky Beans', priceCents: 7500, desc: 'بن فرنسي فاخر مدمج بقطع البندق الحقيقي المقرمش', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Gourmet' },
  { id: 1704, categoryId: 'beans-french', name: 'بن فرنسي كاراميل', nameEn: 'French Caramel Beans', priceCents: 6500, desc: 'بن فرنسي برائحة التوفي والكراميل الذائب اللذيذ', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1705, categoryId: 'beans-french', name: 'بن فرنسي شوكولاتة', nameEn: 'French Chocolate Beans', priceCents: 6500, desc: 'بن فرنسي بنكهة الشوكولاتة والكاكاو السويسري', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1706, categoryId: 'beans-french', name: 'بن فرنسي فستق', nameEn: 'French Pistachio Beans', priceCents: 7500, desc: 'بن فرنسي بطعم الفستق الحلبي الملكي', inStock: true, isRoastery: true, unit: '1/8k' },
  { id: 1707, categoryId: 'beans-french', name: 'بن فرنسي فستق قطع حقيقية', nameEn: 'French Pistachio Real Pieces', priceCents: 8500, desc: 'بن فرنسي ملكي مدمج بقطع وحبيبات الفستق الحلبي الفاخر', inStock: true, isRoastery: true, unit: '1/8k', tag: 'Special Edition' },

  // E. INSTANT COFFEE
  { id: 1801, categoryId: 'beans-instant', name: 'قهوة سريعة الذوبان كلاسيك', nameEn: 'Classic Instant Coffee', priceCents: 5000, desc: 'حبيبات قهوة سريعة التحضير نقية 100% بنكهة غنية', inStock: true, isRoastery: true, unit: 'برطمان' },
  { id: 1802, categoryId: 'beans-instant', name: 'قهوة سريعة الذوبان جولد', nameEn: 'Gold Freeze-Dried Instant', priceCents: 6500, desc: 'حبيبات ذهبية مجففة بالتجميد لمذاق يضاهي الإسبريسو الطازج', inStock: true, isRoastery: true, unit: 'برطمان', tag: 'Gold' },
  { id: 1803, categoryId: 'beans-instant', name: 'كوفي ميكس 3×1', nameEn: 'Coffee Mix 3-in-1 Box', priceCents: 4500, desc: 'مزيج القهوة والحليب والسكر المتوازن (عبوة متعددة الأظرف)', inStock: true, isRoastery: true, unit: 'علبة' },
  { id: 1804, categoryId: 'beans-instant', name: 'كوفي ميكس 2×1', nameEn: 'Coffee Mix 2-in-1 (No Sugar)', priceCents: 4500, desc: 'مزيج القهوة والحليب بدون سكر مضاف لمحبي الطعم الصافي', inStock: true, isRoastery: true, unit: 'علبة' },
  { id: 1805, categoryId: 'beans-instant', name: 'كابتشينو سريع التحضير بالرغوة', nameEn: 'Instant Foamy Cappuccino', priceCents: 5500, desc: 'أظرف كابتشينو سريعة التحضير برغوة كثيفة مع شوكو داستر', inStock: true, isRoastery: true, unit: 'علبة' },
  { id: 1806, categoryId: 'beans-instant', name: 'كافيه إسباني سريع التحضير', nameEn: 'Instant Spanish Latte Pack', priceCents: 6000, desc: 'خلطة إسبانيش لاتيه جاهزة للتحضير الفوري بماء ساخن أو بارد', inStock: true, isRoastery: true, unit: 'علبة' },
  { id: 1807, categoryId: 'beans-instant', name: 'هوت شوكليت فوري', nameEn: 'Instant Hot Chocolate Pack', priceCents: 5000, desc: 'بودرة هوت شوكليت هولندية سريعة الذوبان', inStock: true, isRoastery: true, unit: 'علبة' },
  { id: 1808, categoryId: 'beans-instant', name: 'نسكافيه إسباني خاص', nameEn: 'Special Spanish Instant Coffee', priceCents: 6000, desc: 'توليفة نسكافيه متبلة ومحلاة على الطريقة الإسبانية', inStock: true, isRoastery: true, unit: 'علبة' },

  // F. ARABIC COFFEE
  { id: 1901, categoryId: 'beans-arabic', name: 'قهوة عربي إثيوبي هراري', nameEn: 'Ethiopian Harari Arabic Roast', priceCents: 7500, desc: 'بن هراري ذهبي فاتح مخضر مخصص للدلة والمجالس العربية الأصيلة', inStock: true, isRoastery: true, unit: '1/8k', tag: 'مجالس دياب' },
  { id: 1902, categoryId: 'beans-arabic', name: 'قهوة عربي أحمر تحميص', nameEn: 'Red Roasted Arabic Blend', priceCents: 7000, desc: 'بن عربي بتحميص كستنائي مائل للحمرة مع نكهات دافئة خفيفة', inStock: true, isRoastery: true, unit: '1/8k', tag: 'تحميص خاص' }
];

export const DRINK_MODIFIERS = {
  sizes: [
    { id: 'single', name: 'سينجل / عادي', nameEn: 'Single / Regular', deltaCents: 0 },
    { id: 'double', name: 'دبل / كبير', nameEn: 'Double / Large', deltaCents: 1500 }
  ],
  milks: [
    { id: 'whole', name: 'حليب كامل الدسم', nameEn: 'Whole Milk', deltaCents: 0 },
    { id: 'skim', name: 'حليب خالي الدسم', nameEn: 'Skimmed Milk', deltaCents: 0 },
    { id: 'oat', name: 'حليب شوفان عضوي (+15 ج.م)', nameEn: 'Oat Milk (+15 EGP)', deltaCents: 1500 },
    { id: 'almond', name: 'حليب لوز نقي (+15 ج.م)', nameEn: 'Almond Milk (+15 EGP)', deltaCents: 1500 }
  ],
  sweetness: [
    { id: 'no-sugar', name: 'بدون سكر (Zero)', deltaCents: 0 },
    { id: 'light', name: 'سكر خفيف (1/2 معلقة)', deltaCents: 0 },
    { id: 'medium', name: 'سكر مظبوط (1 معلقة)', deltaCents: 0 },
    { id: 'extra', name: 'سكر زيادة (2 معلقة)', deltaCents: 0 }
  ],
  extraShots: [
    { id: 'none', name: 'بدون شوت إضافي', deltaCents: 0 },
    { id: 'single-shot', name: 'شوت إسبريسو إضافي (+20 ج.م)', deltaCents: 2000 }
  ],
  syrups: [
    { id: 'none', name: 'بدون سيرب إضافي', deltaCents: 0 },
    { id: 'vanilla', name: 'فانيليا (+15 ج.م)', deltaCents: 1500 },
    { id: 'caramel', name: 'كراميل (+15 ج.م)', deltaCents: 1500 },
    { id: 'hazelnut', name: 'بندق (+15 ج.م)', deltaCents: 1500 },
    { id: 'lotus', name: 'لوتس (+20 ج.م)', deltaCents: 2000 },
    { id: 'pistachio', name: 'بستاشيو (+25 ج.م)', deltaCents: 2500 }
  ]
};

export const BEAN_MODIFIERS = {
  weights: [
    { id: 'w125', name: '1/8 كجم (125 جم)', multiplier: 1, label: '1/8 كجم' },
    { id: 'w250', name: '1/4 كجم (250 جم)', multiplier: 2, label: '1/4 كجم' },
    { id: 'w500', name: '1/2 كجم (500 جم)', multiplier: 4, label: '1/2 كجم' },
    { id: 'w1000', name: '1 كجم كامل (1000 جم)', multiplier: 8, label: '1 كجم' }
  ],
  grinds: [
    { id: 'whole-beans', name: 'حبوب كاملة بدون طحن', desc: 'للطحن المنزلي الطازج', deltaCents: 0 },
    { id: 'turkish-fine', name: 'طحن تركي ناعم جداً', desc: 'للكنكة والركوة برغوة', deltaCents: 0 },
    { id: 'espresso-medium', name: 'طحن إسبريسو متوسط النعومة', desc: 'لماكينات الإسبريسو والبورتافلتر', deltaCents: 0 },
    { id: 'filter-coarse', name: 'طحن خشن فلتر / V60 / فرنش برس', desc: 'للتقطير والترشيح والكبس', deltaCents: 0 }
  ],
  roasts: [
    { id: 'light', name: 'تحميص فاتح (Light)', desc: 'حمضية وفاكهية بارزة' },
    { id: 'medium', name: 'تحميص وسط (Medium)', desc: 'توازن ونكهة شوكولاتية متناغمة' },
    { id: 'dark', name: 'تحميص غامق (Dark)', desc: 'قوام ثقيل ونكهة دخانية عميقة' }
  ],
  spicing: [
    { id: 'plain', name: 'سادة بدون إضافات', deltaCents: 0 },
    { id: 'spiced', name: 'تحويجة دياب الكلاسيكية (هيل ومستكة)', deltaCents: 1000 }
  ],
  aromatics: [
    { id: 'mastic', name: 'إضافة مسكة تركية فاخرة (+15 ج.م)', deltaCents: 1500 },
    { id: 'saffron', name: 'إضافة زعفران إيراني أصلي (+25 ج.م)', deltaCents: 2500 },
    { id: 'cardamom', name: 'إضافة هيل أخضر هندي مضاعف (+15 ج.م)', deltaCents: 1500 },
    { id: 'ginger', name: 'إضافة جنزبيل دافئ (+10 ج.م)', deltaCents: 1000 }
  ]
};

export function formatEGP(cents: number): string {
  if (typeof cents !== 'number' || isNaN(cents)) cents = 0;
  const egp = (cents / 100).toFixed(2);
  const clean = egp.endsWith('.00') ? egp.slice(0, -3) : egp;
  return clean + ' ج.م';
}

export const DEFAULT_USER: UserProfile = {
  id: 'usr_cairo_108',
  name: 'أحمد محمود',
  phone: '01012345678',
  authMethod: 'OTP',
  loyaltyPoints: 1450,
  savedAddresses: [
    {
      id: 'addr_home',
      label: 'المنزل',
      city: 'سيدي سالم — وسط البلد',
      street: 'شارع المحكمة، أمام بنك مصر',
      building: 'عمارة ٤، الدور الثاني، شقة ٥',
      isDefault: true
    },
    {
      id: 'addr_office',
      label: 'مكتب العمل',
      city: 'سيدي سالم — حي الزهور',
      street: 'شارع جمال عبد الناصر، مجمع الأطباء',
      building: 'الدور الأول، عيادة / مكتب 3',
      isDefault: false
    }
  ],
  usualOrder: {
    title: 'فلات وايت (حليب شوفان، إكسترا دبل شوت) + كرواسون بالزبدة',
    tag: 'استلام تيك أواي',
    mode: 'PICKUP',
    items: [
      {
        id: 'usual_1',
        productId: 108,
        productName: 'فلات وايت',
        productNameEn: 'Flat White',
        quantity: 1,
        unitPriceCents: 9000,
        totalCents: 9000,
        modifiersSummary: 'حليب شوفان (+15 ج.م)، إكسترا دبل شوت (+20 ج.م)',
        modifiers: { milk: 'oat', shots: 'extra_double' }
      }
    ],
    totalCents: 9000,
    priceDisplay: '90 ج.م'
  }
};
