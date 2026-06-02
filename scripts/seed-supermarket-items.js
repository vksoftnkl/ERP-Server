#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const ACTOR = 'seed-supermarket-items';
const TARGET_ITEM_COUNT = 10000;
const BATCH_SIZE = 500;

const UNITS = [
  { name: 'Piece', alias: 'Pc', code: 'PCS', decimalCount: 0 },
  { name: 'Kilogram', alias: 'Kg', code: 'KG', decimalCount: 3 },
  { name: 'Gram', alias: 'g', code: 'GM', decimalCount: 0 },
  { name: 'Litre', alias: 'L', code: 'LTR', decimalCount: 3 },
  { name: 'Millilitre', alias: 'ml', code: 'ML', decimalCount: 0 },
  { name: 'Packet', alias: 'Pkt', code: 'PACK', decimalCount: 0 },
  { name: 'Bottle', alias: 'Btl', code: 'BOTTLE', decimalCount: 0 },
  { name: 'Box', alias: 'Box', code: 'BOX', decimalCount: 0 },
];

const TAXES = [
  { name: 'GST 0%', code: 'GST0', rate: 0, cgst: 0, sgst: 0, igst: 0 },
  { name: 'GST 5%', code: 'GST5', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
  { name: 'GST 12%', code: 'GST12', rate: 12, cgst: 6, sgst: 6, igst: 12 },
  { name: 'GST 18%', code: 'GST18', rate: 18, cgst: 9, sgst: 9, igst: 18 },
];

const FAMILIES = [
  {
    code: 'RICE',
    group: 'Supermarket Rice and Grains',
    category: 'Rice and Grains',
    unit: 'Kilogram',
    tax: 'GST 5%',
    hsn: '100630',
    bases: ['Sona Masoori Rice', 'Basmati Rice', 'Idli Rice', 'Ponni Rice', 'Brown Rice'],
    variants: ['Premium', 'Raw', 'Boiled', 'Organic', 'Everyday'],
    brands: ['Harvest', 'Annapurna', 'Royal Grain', 'Farm Fresh', 'Daily Choice'],
    packs: ['1 kg', '5 kg', '10 kg', '25 kg'],
    expiryDays: 365,
  },
  {
    code: 'ATTA',
    group: 'Supermarket Flour and Atta',
    category: 'Flour and Atta',
    unit: 'Kilogram',
    tax: 'GST 5%',
    hsn: '110100',
    bases: ['Whole Wheat Atta', 'Maida', 'Ragi Flour', 'Rice Flour', 'Besan'],
    variants: ['Fresh Mill', 'Stone Ground', 'Organic', 'Fortified', 'Classic'],
    brands: ['Kitchen Gold', 'Daily Choice', 'Grain Basket', 'Miller Fresh', 'Home Taste'],
    packs: ['500 g', '1 kg', '2 kg', '5 kg'],
    expiryDays: 180,
  },
  {
    code: 'PULSE',
    group: 'Supermarket Pulses and Lentils',
    category: 'Pulses and Lentils',
    unit: 'Kilogram',
    tax: 'GST 5%',
    hsn: '071390',
    bases: ['Toor Dal', 'Moong Dal', 'Urad Dal', 'Chana Dal', 'Masoor Dal'],
    variants: ['Split', 'Whole', 'Polished', 'Unpolished', 'Organic'],
    brands: ['Farm Fresh', 'Annapurna', 'Daily Choice', 'Harvest', 'Grain Basket'],
    packs: ['500 g', '1 kg', '2 kg', '5 kg'],
    expiryDays: 365,
  },
  {
    code: 'OIL',
    group: 'Supermarket Oils and Ghee',
    category: 'Cooking Oils and Ghee',
    unit: 'Litre',
    tax: 'GST 5%',
    hsn: '151219',
    bases: ['Sunflower Oil', 'Groundnut Oil', 'Mustard Oil', 'Coconut Oil', 'Cow Ghee'],
    variants: ['Refined', 'Cold Pressed', 'Filtered', 'Premium', 'Classic'],
    brands: ['Golden Drop', 'Kitchen Gold', 'Nature Pure', 'Farm Fresh', 'Daily Choice'],
    packs: ['500 ml', '1 L', '2 L', '5 L'],
    expiryDays: 270,
  },
  {
    code: 'SPICE',
    group: 'Supermarket Spices and Masala',
    category: 'Spices and Masala',
    unit: 'Gram',
    tax: 'GST 5%',
    hsn: '091099',
    bases: [
      'Turmeric Powder',
      'Chilli Powder',
      'Coriander Powder',
      'Garam Masala',
      'Sambar Powder',
    ],
    variants: ['Aromatic', 'Extra Hot', 'Classic', 'Homestyle', 'Premium'],
    brands: ['Spice Route', 'Aroma King', 'Kitchen Gold', 'Home Taste', 'Daily Choice'],
    packs: ['50 g', '100 g', '200 g', '500 g'],
    expiryDays: 365,
  },
  {
    code: 'SUGAR',
    group: 'Supermarket Sugar Salt and Jaggery',
    category: 'Sugar Salt and Jaggery',
    unit: 'Kilogram',
    tax: 'GST 5%',
    hsn: '170199',
    bases: ['White Sugar', 'Brown Sugar', 'Crystal Salt', 'Rock Salt', 'Jaggery Powder'],
    variants: ['Fine', 'Natural', 'Iodized', 'Organic', 'Premium'],
    brands: ['Sweet Home', 'Daily Choice', 'Nature Pure', 'Kitchen Gold', 'Farm Fresh'],
    packs: ['500 g', '1 kg', '2 kg', '5 kg'],
    expiryDays: 730,
  },
  {
    code: 'TEA',
    group: 'Supermarket Tea Coffee and Beverages',
    category: 'Tea Coffee and Beverages',
    unit: 'Packet',
    tax: 'GST 5%',
    hsn: '090240',
    bases: ['Tea Powder', 'Green Tea', 'Instant Coffee', 'Filter Coffee', 'Malt Drink'],
    variants: ['Strong', 'Classic', 'Premium', 'Cardamom', 'Masala'],
    brands: ['Morning Brew', 'Cafe Gold', 'Daily Choice', 'Aroma King', 'Fresh Cup'],
    packs: ['100 g', '250 g', '500 g', '1 kg'],
    expiryDays: 365,
  },
  {
    code: 'BISC',
    group: 'Supermarket Biscuits and Cookies',
    category: 'Biscuits and Cookies',
    unit: 'Packet',
    tax: 'GST 18%',
    hsn: '190531',
    bases: [
      'Marie Biscuit',
      'Cream Biscuit',
      'Digestive Biscuit',
      'Butter Cookie',
      'Chocolate Cookie',
    ],
    variants: ['Classic', 'Family Pack', 'Sugar Free', 'Choco Chip', 'Value Pack'],
    brands: ['Snacko', 'Bake House', 'Daily Choice', 'Sweet Bite', 'Crispy Treat'],
    packs: ['75 g', '100 g', '200 g', '400 g'],
    expiryDays: 180,
  },
  {
    code: 'SNACK',
    group: 'Supermarket Snacks and Namkeen',
    category: 'Snacks and Namkeen',
    unit: 'Packet',
    tax: 'GST 12%',
    hsn: '210690',
    bases: ['Potato Chips', 'Mixture Namkeen', 'Banana Chips', 'Murukku', 'Peanut Masala'],
    variants: ['Salted', 'Spicy', 'Masala', 'Family Pack', 'Classic'],
    brands: ['Snacko', 'Crispy Treat', 'Tasty Time', 'Daily Choice', 'Home Taste'],
    packs: ['50 g', '100 g', '200 g', '500 g'],
    expiryDays: 120,
  },
  {
    code: 'CEREAL',
    group: 'Supermarket Breakfast Cereals',
    category: 'Breakfast Cereals',
    unit: 'Packet',
    tax: 'GST 18%',
    hsn: '190410',
    bases: ['Corn Flakes', 'Oats', 'Muesli', 'Choco Cereal', 'Millet Flakes'],
    variants: ['Honey', 'Fruit Mix', 'Classic', 'High Fibre', 'No Added Sugar'],
    brands: ['Morning Bowl', 'Health Harvest', 'Daily Choice', 'Nutri Start', 'Grain Basket'],
    packs: ['250 g', '500 g', '750 g', '1 kg'],
    expiryDays: 270,
  },
  {
    code: 'NOODLE',
    group: 'Supermarket Noodles Pasta and Vermicelli',
    category: 'Noodles Pasta and Vermicelli',
    unit: 'Packet',
    tax: 'GST 12%',
    hsn: '190230',
    bases: ['Instant Noodles', 'Pasta', 'Vermicelli', 'Macaroni', 'Hakka Noodles'],
    variants: ['Masala', 'Tomato', 'Whole Wheat', 'Plain', 'Cheese'],
    brands: ['Quick Meal', 'Daily Choice', 'Kitchen Gold', 'Tasty Time', 'Home Taste'],
    packs: ['70 g', '180 g', '400 g', '1 kg'],
    expiryDays: 270,
  },
  {
    code: 'SAUCE',
    group: 'Supermarket Sauces Pickles and Spreads',
    category: 'Sauces Pickles and Spreads',
    unit: 'Bottle',
    tax: 'GST 12%',
    hsn: '210390',
    bases: ['Tomato Ketchup', 'Chilli Sauce', 'Mixed Pickle', 'Mango Pickle', 'Peanut Butter'],
    variants: ['Classic', 'Spicy', 'No Onion Garlic', 'Creamy', 'Extra Hot'],
    brands: ['Taste Hub', 'Home Taste', 'Daily Choice', 'Kitchen Gold', 'Snacko'],
    packs: ['200 g', '500 g', '700 g', '1 kg'],
    expiryDays: 365,
  },
  {
    code: 'DAIRY',
    group: 'Supermarket Dairy and Fresh',
    category: 'Dairy and Fresh',
    unit: 'Packet',
    tax: 'GST 5%',
    hsn: '040120',
    bases: ['Milk', 'Curd', 'Paneer', 'Butter', 'Cheese Slices'],
    variants: ['Full Cream', 'Toned', 'Fresh', 'Salted', 'Low Fat'],
    brands: ['Dairy Pure', 'Farm Fresh', 'Daily Choice', 'Milky Way', 'Home Taste'],
    packs: ['200 ml', '500 ml', '1 L', '200 g'],
    expiryDays: 14,
  },
  {
    code: 'FROZEN',
    group: 'Supermarket Frozen Foods',
    category: 'Frozen Foods',
    unit: 'Packet',
    tax: 'GST 18%',
    hsn: '210690',
    bases: ['Frozen Peas', 'French Fries', 'Veg Nuggets', 'Paratha', 'Mixed Vegetables'],
    variants: ['Classic', 'Family Pack', 'Ready to Cook', 'Spicy', 'Plain'],
    brands: ['Frost Fresh', 'Quick Meal', 'Daily Choice', 'Kitchen Gold', 'Snacko'],
    packs: ['250 g', '500 g', '750 g', '1 kg'],
    expiryDays: 180,
  },
  {
    code: 'FRUIT',
    group: 'Supermarket Fresh Fruits',
    category: 'Fresh Fruits',
    unit: 'Kilogram',
    tax: 'GST 0%',
    hsn: '080300',
    bases: ['Apple', 'Banana', 'Orange', 'Grapes', 'Pomegranate'],
    variants: ['Fresh', 'Premium', 'Organic', 'Imported', 'Local'],
    brands: ['Farm Fresh', 'Nature Pure', 'Daily Choice', 'Harvest', 'Fresh Pick'],
    packs: ['Loose', '500 g', '1 kg', '2 kg'],
    expiryDays: 7,
    weighScale: true,
  },
  {
    code: 'VEG',
    group: 'Supermarket Fresh Vegetables',
    category: 'Fresh Vegetables',
    unit: 'Kilogram',
    tax: 'GST 0%',
    hsn: '070999',
    bases: ['Tomato', 'Potato', 'Onion', 'Carrot', 'Beans'],
    variants: ['Fresh', 'Premium', 'Organic', 'Washed', 'Local'],
    brands: ['Farm Fresh', 'Nature Pure', 'Daily Choice', 'Harvest', 'Fresh Pick'],
    packs: ['Loose', '500 g', '1 kg', '2 kg'],
    expiryDays: 7,
    weighScale: true,
  },
  {
    code: 'BAKERY',
    group: 'Supermarket Bakery',
    category: 'Bakery',
    unit: 'Packet',
    tax: 'GST 5%',
    hsn: '190590',
    bases: ['White Bread', 'Brown Bread', 'Pav Bun', 'Rusk', 'Fruit Cake'],
    variants: ['Fresh', 'Whole Wheat', 'Milk', 'Classic', 'Family Pack'],
    brands: ['Bake House', 'Daily Choice', 'Home Taste', 'Sweet Bite', 'Morning Fresh'],
    packs: ['200 g', '400 g', '600 g', '1 pack'],
    expiryDays: 7,
  },
  {
    code: 'CHOC',
    group: 'Supermarket Confectionery',
    category: 'Confectionery',
    unit: 'Piece',
    tax: 'GST 18%',
    hsn: '180690',
    bases: ['Milk Chocolate', 'Dark Chocolate', 'Toffee', 'Lollipop', 'Candy'],
    variants: ['Classic', 'Nutty', 'Fruit', 'Mini', 'Value Pack'],
    brands: ['Sweet Bite', 'Choco Joy', 'Daily Choice', 'Candy House', 'Snacko'],
    packs: ['1 pc', '50 g', '100 g', '200 g'],
    expiryDays: 365,
  },
  {
    code: 'PC',
    group: 'Supermarket Personal Care',
    category: 'Personal Care',
    unit: 'Bottle',
    tax: 'GST 18%',
    hsn: '330499',
    bases: ['Body Wash', 'Hand Wash', 'Talcum Powder', 'Body Lotion', 'Face Wash'],
    variants: ['Aloe', 'Lemon', 'Rose', 'Sensitive', 'Classic'],
    brands: ['Care Plus', 'Fresh Glow', 'Daily Choice', 'Soft Touch', 'Pure Care'],
    packs: ['100 ml', '200 ml', '400 ml', '500 ml'],
  },
  {
    code: 'HAIR',
    group: 'Supermarket Hair Care',
    category: 'Hair Care',
    unit: 'Bottle',
    tax: 'GST 18%',
    hsn: '330510',
    bases: ['Shampoo', 'Conditioner', 'Hair Oil', 'Hair Serum', 'Hair Cream'],
    variants: ['Anti Dandruff', 'Coconut', 'Aloe', 'Damage Repair', 'Classic'],
    brands: ['Care Plus', 'Fresh Glow', 'Daily Choice', 'Soft Touch', 'Pure Care'],
    packs: ['90 ml', '180 ml', '340 ml', '650 ml'],
  },
  {
    code: 'SKIN',
    group: 'Supermarket Skin Care',
    category: 'Skin Care',
    unit: 'Piece',
    tax: 'GST 18%',
    hsn: '330499',
    bases: ['Moisturizer', 'Sunscreen', 'Face Cream', 'Face Scrub', 'Lip Balm'],
    variants: ['Aloe', 'Vitamin C', 'SPF 30', 'Sensitive', 'Classic'],
    brands: ['Fresh Glow', 'Care Plus', 'Daily Choice', 'Soft Touch', 'Pure Care'],
    packs: ['25 g', '50 g', '100 g', '200 g'],
  },
  {
    code: 'ORAL',
    group: 'Supermarket Oral Care',
    category: 'Oral Care',
    unit: 'Piece',
    tax: 'GST 18%',
    hsn: '330610',
    bases: ['Toothpaste', 'Toothbrush', 'Mouthwash', 'Dental Floss', 'Kids Toothpaste'],
    variants: ['Mint', 'Sensitive', 'Herbal', 'Soft', 'Classic'],
    brands: ['Bright Smile', 'Care Plus', 'Daily Choice', 'Pure Care', 'Fresh Mint'],
    packs: ['1 pc', '80 g', '150 g', '250 ml'],
  },
  {
    code: 'CLEAN',
    group: 'Supermarket Household Cleaning',
    category: 'Household Cleaning',
    unit: 'Bottle',
    tax: 'GST 18%',
    hsn: '340220',
    bases: ['Floor Cleaner', 'Toilet Cleaner', 'Glass Cleaner', 'Dishwash Liquid', 'Disinfectant'],
    variants: ['Lemon', 'Pine', 'Jasmine', 'Strong', 'Classic'],
    brands: ['Clean Mate', 'Daily Choice', 'Home Shield', 'Sparkle', 'Fresh Home'],
    packs: ['250 ml', '500 ml', '1 L', '5 L'],
  },
  {
    code: 'LAUNDRY',
    group: 'Supermarket Laundry',
    category: 'Laundry',
    unit: 'Packet',
    tax: 'GST 18%',
    hsn: '340290',
    bases: [
      'Detergent Powder',
      'Detergent Liquid',
      'Fabric Softener',
      'Washing Bar',
      'Stain Remover',
    ],
    variants: ['Lemon', 'Jasmine', 'Front Load', 'Top Load', 'Classic'],
    brands: ['Clean Mate', 'Daily Choice', 'Fresh Home', 'Sparkle', 'Home Shield'],
    packs: ['200 g', '500 g', '1 kg', '2 kg'],
  },
  {
    code: 'KITCHEN',
    group: 'Supermarket Kitchen Essentials',
    category: 'Kitchen Essentials',
    unit: 'Piece',
    tax: 'GST 18%',
    hsn: '392410',
    bases: ['Aluminium Foil', 'Cling Film', 'Garbage Bag', 'Paper Napkin', 'Scrub Pad'],
    variants: ['Standard', 'Heavy Duty', 'Eco', 'Value Pack', 'Classic'],
    brands: ['Kitchen Gold', 'Daily Choice', 'Home Shield', 'Clean Mate', 'Fresh Home'],
    packs: ['1 pc', '10 pcs', '25 pcs', '50 pcs'],
  },
  {
    code: 'BABY',
    group: 'Supermarket Baby Care',
    category: 'Baby Care',
    unit: 'Packet',
    tax: 'GST 12%',
    hsn: '961900',
    bases: ['Baby Diapers', 'Baby Wipes', 'Baby Lotion', 'Baby Soap', 'Baby Powder'],
    variants: ['Small', 'Medium', 'Large', 'Gentle', 'Aloe'],
    brands: ['Baby Soft', 'Care Plus', 'Daily Choice', 'Pure Care', 'Tiny Care'],
    packs: ['10 pcs', '20 pcs', '50 pcs', '100 ml'],
  },
  {
    code: 'PET',
    group: 'Supermarket Pet Food',
    category: 'Pet Food',
    unit: 'Packet',
    tax: 'GST 18%',
    hsn: '230910',
    bases: ['Dog Food', 'Cat Food', 'Pet Treats', 'Puppy Food', 'Kitten Food'],
    variants: ['Chicken', 'Fish', 'Veg', 'Adult', 'Junior'],
    brands: ['Pet Bowl', 'Daily Choice', 'Happy Paws', 'Nutri Pet', 'Fresh Bite'],
    packs: ['100 g', '500 g', '1 kg', '3 kg'],
    expiryDays: 365,
  },
  {
    code: 'STATION',
    group: 'Supermarket Stationery',
    category: 'Stationery',
    unit: 'Piece',
    tax: 'GST 12%',
    hsn: '960810',
    bases: ['Ball Pen', 'Notebook', 'Pencil', 'Eraser', 'Glue Stick'],
    variants: ['Blue', 'Black', 'Ruled', 'Plain', 'Value Pack'],
    brands: ['Write Well', 'Daily Choice', 'Office Mate', 'Study Plus', 'Paper Craft'],
    packs: ['1 pc', '5 pcs', '10 pcs', '20 pcs'],
  },
  {
    code: 'HEALTH',
    group: 'Supermarket Health and Wellness',
    category: 'Health and Wellness',
    unit: 'Bottle',
    tax: 'GST 12%',
    hsn: '210690',
    bases: ['Protein Drink', 'Glucose Powder', 'Honey', 'Chyawanprash', 'Health Mix'],
    variants: ['Classic', 'Sugar Free', 'Chocolate', 'Herbal', 'Family Pack'],
    brands: ['Health Harvest', 'Nutri Start', 'Daily Choice', 'Nature Pure', 'Care Plus'],
    packs: ['100 g', '250 g', '500 g', '1 kg'],
    expiryDays: 365,
  },
  {
    code: 'DRINK',
    group: 'Supermarket Cold Drinks and Juices',
    category: 'Cold Drinks and Juices',
    unit: 'Bottle',
    tax: 'GST 18%',
    hsn: '220210',
    bases: ['Cola Drink', 'Orange Juice', 'Mango Drink', 'Soda Water', 'Energy Drink'],
    variants: ['Classic', 'Diet', 'No Added Sugar', 'Chilled', 'Family Pack'],
    brands: ['Fresh Sip', 'Cool Wave', 'Daily Choice', 'Fruit Drop', 'Fizz Up'],
    packs: ['250 ml', '500 ml', '1 L', '2 L'],
    expiryDays: 180,
  },
];

const pick = (values, index, stride = 1) => values[Math.floor(index / stride) % values.length];

const toPaddedNumber = (value, width) => String(value).padStart(width, '0');

const buildBarcode = (index) => `890${toPaddedNumber(1000000000 + index, 10).slice(-10)}`;

const findOrCreateCompany = async () => {
  const existingDefault = await prisma.company.findFirst({
    where: { compIsDeleted: false, compDefault: true },
    select: { compId: true, compName: true },
    orderBy: { compCreatedOn: 'asc' },
  });

  if (existingDefault) {
    return existingDefault;
  }

  const existing = await prisma.company.findFirst({
    where: { compIsDeleted: false },
    select: { compId: true, compName: true },
    orderBy: { compCreatedOn: 'asc' },
  });

  if (existing) {
    return existing;
  }

  return prisma.company.create({
    data: {
      compName: 'Demo Supermarket Company',
      compShort: 'Supermarket',
      compLegalName: 'Demo Supermarket Company',
      compStateCode: '33',
      compCountry: 'India',
      compDefault: true,
      compIsActive: true,
      compIsDeleted: false,
      compCreatedBy: ACTOR,
      compModifiedBy: ACTOR,
    },
    select: { compId: true, compName: true },
  });
};

const upsertUnits = async () => {
  const entries = new Map();

  for (const unit of UNITS) {
    const existing = await prisma.unit.findUnique({
      where: { unit_name: unit.name },
      select: { unit_id: true, unit_name: true },
    });
    const record =
      existing ??
      (await prisma.unit.create({
        data: {
          unit_name: unit.name,
          unit_alias: unit.alias,
          unit_code: unit.code,
          unit_description: `${unit.name} supermarket seed unit`,
          unit_decimal_count: unit.decimalCount,
          unit_is_active: true,
          unit_is_deleted: false,
          unit_created_by: ACTOR,
          unit_modified_by: ACTOR,
        },
        select: { unit_id: true, unit_name: true },
      }));

    entries.set(record.unit_name, record.unit_id);
  }

  return entries;
};

const upsertTaxes = async () => {
  const entries = new Map();

  for (const tax of TAXES) {
    const existing = await prisma.itemTaxMaster.findUnique({
      where: { taxName: tax.name },
      select: { taxId: true, taxName: true },
    });
    const record =
      existing ??
      (await prisma.itemTaxMaster.create({
        data: {
          taxName: tax.name,
          taxCode: tax.code,
          taxTaxabilityType: tax.rate === 0 ? 'EXEMPT' : 'TAXABLE',
          taxCgstPerc: tax.cgst,
          taxSgstPerc: tax.sgst,
          taxIgstPerc: tax.igst,
          taxCgstPurPerc: tax.cgst,
          taxSgstPurPerc: tax.sgst,
          taxIgstPurPerc: tax.igst,
          taxGstRateTotal: tax.rate,
          taxIsActive: true,
          taxIsDeleted: false,
          taxCreatedBy: ACTOR,
          taxModifiedBy: ACTOR,
        },
        select: { taxId: true, taxName: true },
      }));

    entries.set(record.taxName, record.taxId);
  }

  return entries;
};

const upsertGroups = async (unitMap, taxMap) => {
  const entries = new Map();

  for (const [index, family] of FAMILIES.entries()) {
    const record = await prisma.itemGroupMaster.upsert({
      where: { itgName: family.group },
      update: {
        itgAlias: family.category,
        itgShort: family.code,
        itgDescription: `${family.category} products for supermarket item seed`,
        itgSort: index + 1,
        itgLevel: 0,
        itgDefaultTaxId: taxMap.get(family.tax) ?? null,
        itgDefaultHsn: family.hsn,
        itgDefaultUomId: unitMap.get(family.unit) ?? null,
        itgIsActive: true,
        itgIsDeleted: false,
        itgModifiedBy: ACTOR,
        itgModifiedOn: new Date(),
      },
      create: {
        itgName: family.group,
        itgAlias: family.category,
        itgShort: family.code,
        itgDescription: `${family.category} products for supermarket item seed`,
        itgSort: index + 1,
        itgLevel: 0,
        itgDefaultTaxId: taxMap.get(family.tax) ?? null,
        itgDefaultHsn: family.hsn,
        itgDefaultUomId: unitMap.get(family.unit) ?? null,
        itgIsActive: true,
        itgIsDeleted: false,
        itgCreatedBy: ACTOR,
        itgModifiedBy: ACTOR,
      },
      select: { itgId: true, itgName: true },
    });

    await prisma.itemGroupMaster.update({
      where: { itgId: record.itgId },
      data: { itgPathIdsCache: [record.itgId] },
    });

    entries.set(record.itgName, record.itgId);
  }

  return entries;
};

const upsertCategories = async () => {
  const entries = new Map();

  for (const [index, family] of FAMILIES.entries()) {
    const record = await prisma.categoryMaster.upsert({
      where: { categoryName: family.group },
      update: {
        categoryAlias: family.category,
        categoryShort: family.code,
        categoryDescription: `${family.category} supermarket seed category`,
        categorySort: index + 1,
        categoryLevel: 0,
        categoryIsActive: true,
        categoryIsDeleted: false,
        categoryModifiedBy: ACTOR,
        categoryModifiedOn: new Date(),
      },
      create: {
        categoryName: family.group,
        categoryAlias: family.category,
        categoryShort: family.code,
        categoryDescription: `${family.category} supermarket seed category`,
        categorySort: index + 1,
        categoryLevel: 0,
        categoryIsActive: true,
        categoryIsDeleted: false,
        categoryCreatedBy: ACTOR,
        categoryModifiedBy: ACTOR,
      },
      select: { categoryId: true, categoryName: true },
    });

    await prisma.categoryMaster.update({
      where: { categoryId: record.categoryId },
      data: { categoryPathIdsCache: [record.categoryId] },
    });

    entries.set(family.category, record.categoryId);
  }

  return entries;
};

const buildItem = (index, companyId, unitMap, taxMap, groupMap, categoryMap) => {
  const family = FAMILIES[(index - 1) % FAMILIES.length];
  const codeNumber = toPaddedNumber(index, 5);
  const base = pick(family.bases, index - 1);
  const variant = pick(family.variants, index - 1, family.bases.length);
  const brand = pick(family.brands, index - 1, family.bases.length * family.variants.length);
  const pack = pick(
    family.packs,
    index - 1,
    family.bases.length * family.variants.length * family.brands.length,
  );

  const itemCode = `SM-${family.code}-${codeNumber}`;
  const itemNameEn = `${brand} ${variant} ${base} ${pack} ${itemCode}`;

  return {
    itemCompanyId: companyId,
    itemCode,
    itemSku: itemCode,
    itemNameEn,
    itemAlias: `${base} ${pack}`,
    itemStockType: 'FG',
    itemDefaultBarcode: buildBarcode(index),
    itemGroupId: groupMap.get(family.group),
    itemCategoryId: categoryMap.get(family.category) ?? null,
    itemBaseUnitId: unitMap.get(family.unit) ?? null,
    itemDefaultTaxId: taxMap.get(family.tax) ?? null,
    itemHsnCode: family.hsn,
    itemIsService: false,
    itemIsBatchBased: false,
    itemIsExpiryItem: Boolean(family.expiryDays),
    itemExpiryDays: family.expiryDays ?? null,
    itemIntimateBeforeDays: family.expiryDays
      ? Math.min(30, Math.max(3, Math.floor(family.expiryDays / 6)))
      : null,
    itemAllowSales: true,
    itemAllowSalesReturn: true,
    itemAllowPurchase: true,
    itemAllowPo: true,
    itemAllowSo: true,
    itemAllowNegStock: true,
    itemAllowNegativeSo: true,
    itemRetailItem: true,
    itemWeighScale: Boolean(family.weighScale),
    itemAllowLoyalty: true,
    itemAllowPromo: true,
    itemBatchConfig: 0,
    itemSortOrder: index,
    itemNotes: `Supermarket seed item ${codeNumber}`,
    itemStorageLocation: family.category,
    itemPackingItemIds: [],
    itemIsActive: true,
    itemIsDeleted: false,
    itemCreatedBy: ACTOR,
    itemModifiedBy: ACTOR,
  };
};
const insertItems = async (companyId, unitMap, taxMap, groupMap, categoryMap) => {
  let created = 0;

  for (let start = 1; start <= TARGET_ITEM_COUNT; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, TARGET_ITEM_COUNT);
    const data = [];

    for (let index = start; index <= end; index += 1) {
      data.push(buildItem(index, companyId, unitMap, taxMap, groupMap, categoryMap));
    }

    const result = await prisma.itemMaster.createMany({
      data,
      skipDuplicates: true,
    });

    created += result.count;
    console.log(`Processed items ${start}-${end}. created_in_batch=${result.count}`);
  }

  return created;
};

async function main() {
  const company = await findOrCreateCompany();
  const [unitMap, taxMap] = await Promise.all([upsertUnits(), upsertTaxes()]);
  const [groupMap, categoryMap] = await Promise.all([
    upsertGroups(unitMap, taxMap),
    upsertCategories(),
  ]);

  const created = await insertItems(company.compId, unitMap, taxMap, groupMap, categoryMap);
  const seededTotal = await prisma.itemMaster.count({
    where: { itemCreatedBy: ACTOR },
  });
  const tableTotal = await prisma.itemMaster.count();

  console.log(
    `Supermarket item seed complete. company="${company.compName}", created=${created}, seeded_total=${seededTotal}, item_master_total=${tableTotal}`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to seed supermarket item_master products:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
