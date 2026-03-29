export type DemoProduct = {
    id: string
    name: string
    category: string
    current_price: number
    history: number[]
}

export type DemoStore = {
    id: string
    name: string
    address: string
    lat: number
    lng: number
    district: 'Chennai' | 'Tiruvallur' | 'Chengalpattu' | 'Kanchipuram'
    products: DemoProduct[]
}

// Panimalar Engineering College: 13.0358°N, 80.1703°E

export const demoMetroStores: DemoStore[] = [
    {
        id: 'store-adyar-fresh-mart',
        name: 'Adyar Fresh Mart',
        address: 'LB Road, Adyar, Chennai, Tamil Nadu',
        lat: 13.0067,
        lng: 80.2571,
        district: 'Chennai',
        products: [
            { id: 'adyar-milk', name: 'Milk 1L', category: 'Dairy', current_price: 56, history: [56, 57, 55, 54] },
            { id: 'adyar-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 44, history: [44, 45, 43, 42] },
            { id: 'adyar-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 118, history: [118, 121, 119, 116] },
            { id: 'adyar-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 96, history: [96, 97, 94, 93] },
            { id: 'adyar-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 38, history: [38, 39, 37, 36] },
        ],
    },
    {
        id: 'store-anna-nagar-daily-needs',
        name: 'Anna Nagar Daily Needs',
        address: '2nd Avenue, Anna Nagar, Chennai, Tamil Nadu',
        lat: 13.086,
        lng: 80.2101,
        district: 'Chennai',
        products: [
            { id: 'anna-milk', name: 'Milk 1L', category: 'Dairy', current_price: 54, history: [54, 55, 55, 53] },
            { id: 'anna-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 42, history: [42, 43, 41, 40] },
            { id: 'anna-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 58, history: [58, 59, 57, 56] },
            { id: 'anna-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 49, history: [49, 50, 47, 46] },
            { id: 'anna-bread', name: 'Bread 400g', category: 'Bakery', current_price: 35, history: [35, 36, 34, 34] },
        ],
    },
    {
        id: 'store-t-nagar-family-store',
        name: 'T Nagar Family Store',
        address: 'South Usman Road, T Nagar, Chennai, Tamil Nadu',
        lat: 13.0418,
        lng: 80.2337,
        district: 'Chennai',
        products: [
            { id: 'tnagar-milk', name: 'Milk 1L', category: 'Dairy', current_price: 57, history: [57, 56, 55, 54] },
            { id: 'tnagar-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 43, history: [43, 43, 42, 41] },
            { id: 'tnagar-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 121, history: [121, 123, 122, 120] },
            { id: 'tnagar-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 68, history: [68, 67, 66, 65] },
            { id: 'tnagar-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 98, history: [98, 99, 97, 95] },
        ],
    },
    {
        id: 'store-ambattur-smart-mart',
        name: 'Ambattur Smart Mart',
        address: 'MTH Road, Ambattur, Tiruvallur, Tamil Nadu',
        lat: 13.1143,
        lng: 80.1548,
        district: 'Tiruvallur',
        products: [
            { id: 'ambattur-milk', name: 'Milk 1L', category: 'Dairy', current_price: 53, history: [53, 54, 54, 52] },
            { id: 'ambattur-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 41, history: [41, 42, 40, 40] },
            { id: 'ambattur-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 112, history: [112, 114, 113, 111] },
            { id: 'ambattur-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 55, history: [55, 56, 54, 53] },
            { id: 'ambattur-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 36, history: [36, 37, 35, 35] },
        ],
    },
    {
        id: 'store-tiruvallur-town-grocers',
        name: 'Tiruvallur Town Grocers',
        address: 'J N Road, Tiruvallur, Tamil Nadu',
        lat: 13.1439,
        lng: 79.9089,
        district: 'Tiruvallur',
        products: [
            { id: 'tiruvallur-milk', name: 'Milk 1L', category: 'Dairy', current_price: 52, history: [52, 53, 52, 51] },
            { id: 'tiruvallur-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 40, history: [40, 41, 40, 39] },
            { id: 'tiruvallur-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 54, history: [54, 55, 53, 52] },
            { id: 'tiruvallur-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 142, history: [142, 144, 141, 139] },
            { id: 'tiruvallur-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 47, history: [47, 48, 46, 45] },
        ],
    },
    {
        id: 'store-tambaram-value-store',
        name: 'Tambaram Value Store',
        address: 'GST Road, Tambaram, Chengalpattu, Tamil Nadu',
        lat: 12.9249,
        lng: 80.1275,
        district: 'Chengalpattu',
        products: [
            { id: 'tambaram-milk', name: 'Milk 1L', category: 'Dairy', current_price: 55, history: [55, 56, 54, 53] },
            { id: 'tambaram-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 43, history: [43, 44, 42, 41] },
            { id: 'tambaram-bread', name: 'Bread 400g', category: 'Bakery', current_price: 34, history: [34, 35, 34, 33] },
            { id: 'tambaram-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 66, history: [66, 67, 65, 64] },
            { id: 'tambaram-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 94, history: [94, 95, 93, 92] },
        ],
    },
    {
        id: 'store-guduvanchery-grocery-hub',
        name: 'Guduvanchery Grocery Hub',
        address: 'GST Road, Guduvanchery, Chengalpattu, Tamil Nadu',
        lat: 12.8433,
        lng: 80.0603,
        district: 'Chengalpattu',
        products: [
            { id: 'guduvanchery-milk', name: 'Milk 1L', category: 'Dairy', current_price: 54, history: [54, 55, 53, 52] },
            { id: 'guduvanchery-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 42, history: [42, 43, 41, 40] },
            { id: 'guduvanchery-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 115, history: [115, 117, 116, 114] },
            { id: 'guduvanchery-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 35, history: [35, 36, 35, 34] },
            { id: 'guduvanchery-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 48, history: [48, 49, 47, 46] },
        ],
    },
    {
        id: 'store-sriperumbudur-essentials',
        name: 'Sriperumbudur Essentials',
        address: 'Bangalore Highway, Sriperumbudur, Kanchipuram, Tamil Nadu',
        lat: 12.968,
        lng: 79.9474,
        district: 'Kanchipuram',
        products: [
            { id: 'sriperumbudur-milk', name: 'Milk 1L', category: 'Dairy', current_price: 53, history: [53, 54, 53, 52] },
            { id: 'sriperumbudur-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 41, history: [41, 42, 41, 40] },
            { id: 'sriperumbudur-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 56, history: [56, 57, 55, 54] },
            { id: 'sriperumbudur-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 111, history: [111, 113, 112, 110] },
            { id: 'sriperumbudur-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 139, history: [139, 141, 138, 136] },
        ],
    },
    {
        id: 'store-kanchipuram-town-mart',
        name: 'Kanchipuram Town Mart',
        address: 'Gandhi Road, Kanchipuram, Tamil Nadu',
        lat: 12.8342,
        lng: 79.7036,
        district: 'Kanchipuram',
        products: [
            { id: 'kanchi-milk', name: 'Milk 1L', category: 'Dairy', current_price: 52, history: [52, 53, 52, 51] },
            { id: 'kanchi-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 40, history: [40, 41, 39, 39] },
            { id: 'kanchi-bread', name: 'Bread 400g', category: 'Bakery', current_price: 33, history: [33, 34, 33, 32] },
            { id: 'kanchi-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 92, history: [92, 93, 91, 90] },
            { id: 'kanchi-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 64, history: [64, 65, 63, 62] },
        ],
    },
    // ── Panimalar Engineering College neighbourhood stores ──────────────────
    {
        id: 'store-nazarethpet-provisions',
        name: 'Nazarethpet Provisions',
        address: 'Nazarethpet Main Road, Poonamallee, Chennai, Tamil Nadu',
        lat: 13.0319,
        lng: 80.1578,
        district: 'Chennai',
        products: [
            { id: 'naz-milk', name: 'Milk 1L', category: 'Dairy', current_price: 54, history: [54, 55, 54, 53] },
            { id: 'naz-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 42, history: [42, 43, 41, 40] },
            { id: 'naz-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 57, history: [57, 58, 56, 55] },
            { id: 'naz-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 116, history: [116, 118, 115, 113] },
            { id: 'naz-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 48, history: [48, 49, 47, 46] },
            { id: 'naz-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 66, history: [66, 67, 65, 64] },
        ],
    },
    {
        id: 'store-porur-super-mart',
        name: 'Porur Super Mart',
        address: 'Porur Main Road, Porur, Chennai, Tamil Nadu',
        lat: 13.0347,
        lng: 80.1569,
        district: 'Chennai',
        products: [
            { id: 'porur-milk', name: 'Milk 1L', category: 'Dairy', current_price: 55, history: [55, 56, 55, 54] },
            { id: 'porur-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 43, history: [43, 44, 42, 41] },
            { id: 'porur-bread', name: 'Bread 400g', category: 'Bakery', current_price: 34, history: [34, 35, 34, 33] },
            { id: 'porur-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 95, history: [95, 96, 94, 93] },
            { id: 'porur-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 37, history: [37, 38, 36, 35] },
            { id: 'porur-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 140, history: [140, 142, 139, 137] },
        ],
    },
    {
        id: 'store-valasaravakkam-grocery',
        name: 'Valasaravakkam Grocery Store',
        address: '100 Feet Road, Valasaravakkam, Chennai, Tamil Nadu',
        lat: 13.039,
        lng: 80.185,
        district: 'Chennai',
        products: [
            { id: 'vala-milk', name: 'Milk 1L', category: 'Dairy', current_price: 56, history: [56, 57, 55, 54] },
            { id: 'vala-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 44, history: [44, 45, 43, 42] },
            { id: 'vala-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 119, history: [119, 121, 118, 116] },
            { id: 'vala-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 50, history: [50, 51, 49, 48] },
            { id: 'vala-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 67, history: [67, 68, 66, 65] },
            { id: 'vala-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 58, history: [58, 59, 57, 56] },
        ],
    },
    {
        id: 'store-poonamallee-fresh-market',
        name: 'Poonamallee Fresh Market',
        address: 'Poonamallee High Road, Poonamallee, Chennai, Tamil Nadu',
        lat: 13.0437,
        lng: 80.1257,
        district: 'Chennai',
        products: [
            { id: 'poon-milk', name: 'Milk 1L', category: 'Dairy', current_price: 53, history: [53, 54, 53, 52] },
            { id: 'poon-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 41, history: [41, 42, 40, 40] },
            { id: 'poon-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 56, history: [56, 57, 55, 54] },
            { id: 'poon-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 36, history: [36, 37, 35, 35] },
            { id: 'poon-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 94, history: [94, 95, 93, 92] },
            { id: 'poon-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 138, history: [138, 140, 137, 135] },
        ],
    },
    {
        id: 'store-mogappair-daily-needs',
        name: 'Mogappair Daily Needs',
        address: 'Mogappair East, Anna Nagar West Extension, Chennai, Tamil Nadu',
        lat: 13.0747,
        lng: 80.1736,
        district: 'Chennai',
        products: [
            { id: 'mog-milk', name: 'Milk 1L', category: 'Dairy', current_price: 55, history: [55, 56, 54, 53] },
            { id: 'mog-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 43, history: [43, 44, 42, 41] },
            { id: 'mog-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 117, history: [117, 119, 116, 114] },
            { id: 'mog-bread', name: 'Bread 400g', category: 'Bakery', current_price: 35, history: [35, 36, 34, 33] },
            { id: 'mog-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 49, history: [49, 50, 48, 47] },
            { id: 'mog-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 66, history: [66, 67, 65, 64] },
        ],
    },
    {
        id: 'store-pattabiram-general-store',
        name: 'Pattabiram General Store',
        address: 'Pattabiram Main Street, Pattabiram, Tiruvallur, Tamil Nadu',
        lat: 13.0719,
        lng: 80.1486,
        district: 'Tiruvallur',
        products: [
            { id: 'patt-milk', name: 'Milk 1L', category: 'Dairy', current_price: 52, history: [52, 53, 52, 51] },
            { id: 'patt-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 40, history: [40, 41, 40, 39] },
            { id: 'patt-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 55, history: [55, 56, 54, 53] },
            { id: 'patt-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 113, history: [113, 115, 112, 110] },
            { id: 'patt-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 137, history: [137, 139, 136, 134] },
            { id: 'patt-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 36, history: [36, 37, 35, 34] },
        ],
    },
    {
        id: 'store-avadi-road-essentials',
        name: 'Avadi Road Essentials',
        address: 'Avadi Road, Villivakkam North, Chennai, Tamil Nadu',
        lat: 13.0614,
        lng: 80.1622,
        district: 'Chennai',
        products: [
            { id: 'avad-milk', name: 'Milk 1L', category: 'Dairy', current_price: 54, history: [54, 55, 53, 52] },
            { id: 'avad-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 42, history: [42, 43, 41, 40] },
            { id: 'avad-toothpaste', name: 'Toothpaste 200g', category: 'Personal Care', current_price: 96, history: [96, 97, 95, 93] },
            { id: 'avad-soap', name: 'Bath Soap Pack', category: 'Personal Care', current_price: 67, history: [67, 68, 66, 65] },
            { id: 'avad-eggs', name: 'Eggs 6 pack', category: 'Poultry', current_price: 48, history: [48, 49, 47, 46] },
            { id: 'avad-bread', name: 'Bread 400g', category: 'Bakery', current_price: 34, history: [34, 35, 33, 33] },
        ],
    },
    {
        id: 'store-kattupakkam-provisions',
        name: 'Kattupakkam Provisions',
        address: 'Kattupakkam Village Road, Kattupakkam, Chennai, Tamil Nadu',
        lat: 13.0236,
        lng: 80.1437,
        district: 'Chennai',
        products: [
            { id: 'katt-milk', name: 'Milk 1L', category: 'Dairy', current_price: 53, history: [53, 54, 52, 51] },
            { id: 'katt-coke', name: 'Coca Cola 750ml', category: 'Soft Drinks', current_price: 41, history: [41, 42, 40, 39] },
            { id: 'katt-rice', name: 'Ponni Rice 1kg', category: 'Staples', current_price: 56, history: [56, 57, 55, 54] },
            { id: 'katt-detergent', name: 'Detergent Powder 1kg', category: 'Home Care', current_price: 114, history: [114, 116, 113, 111] },
            { id: 'katt-biscuits', name: 'Biscuits Family Pack', category: 'Snacks', current_price: 35, history: [35, 36, 34, 34] },
            { id: 'katt-oil', name: 'Sunflower Oil 1L', category: 'Staples', current_price: 138, history: [138, 140, 137, 135] },
        ],
    },
]
