#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const ACTOR = 'seed-item-group-master';

const DUMMY_ITEM_GROUPS = [
  {
    name: '5G Smartphones',
    alias: 'Smartphones',
    short: 'PHONE',
    description: 'Android and iOS smartphones with 5G support',
  },
  {
    name: 'Gaming Laptops',
    alias: 'Laptops',
    short: 'LAPTOP',
    description: 'High-performance laptops for gaming and creator workloads',
  },
  {
    name: 'Wireless Earbuds',
    alias: 'Earbuds',
    short: 'EARBUD',
    description: 'True wireless earbuds with ANC and long battery life',
  },
  {
    name: 'Smart Watches',
    alias: 'Watches',
    short: 'WATCH',
    description: 'Fitness and health tracking smartwatches',
  },
  {
    name: 'Bluetooth Speakers',
    alias: 'Speakers',
    short: 'SPKR',
    description: 'Portable and home Bluetooth audio speakers',
  },
  {
    name: 'DSLR Cameras',
    alias: 'Cameras',
    short: 'CAM',
    description: 'Professional DSLR and mirrorless camera equipment',
  },
  {
    name: 'Running Shoes',
    alias: 'Shoes',
    short: 'RSHOE',
    description: 'Lightweight running shoes for men and women',
  },
  {
    name: 'Casual Sneakers',
    alias: 'Sneakers',
    short: 'SNEAK',
    description: 'Everyday lifestyle sneakers in trending styles',
  },
  {
    name: 'Men T-Shirts',
    alias: 'Tees',
    short: 'MTEE',
    description: 'Cotton and dry-fit t-shirts for daily wear',
  },
  {
    name: 'Women Dresses',
    alias: 'Dresses',
    short: 'WDRES',
    description: 'Casual and party wear dresses for women',
  },
  {
    name: 'Denim Jeans',
    alias: 'Jeans',
    short: 'JEANS',
    description: 'Slim, regular, and stretch denim collections',
  },
  {
    name: 'Winter Jackets',
    alias: 'Jackets',
    short: 'JACKT',
    description: 'Insulated and weatherproof jackets for winter',
  },
  {
    name: 'Organic Fruits',
    alias: 'Fruits',
    short: 'FRUIT',
    description: 'Fresh organic seasonal fruits sourced daily',
  },
  {
    name: 'Fresh Vegetables',
    alias: 'Vegetables',
    short: 'VEG',
    description: 'Farm-fresh vegetables for everyday cooking',
  },
  {
    name: 'Dairy Products',
    alias: 'Dairy',
    short: 'DAIRY',
    description: 'Milk, paneer, curd, and butter products',
  },
  {
    name: 'Snacks and Namkeen',
    alias: 'Snacks',
    short: 'SNACK',
    description: 'Ready-to-eat snacks and savory namkeen items',
  },
  {
    name: 'Cooking Oils',
    alias: 'Oils',
    short: 'OIL',
    description: 'Refined, cold-pressed, and blended cooking oils',
  },
  {
    name: 'Protein Powders',
    alias: 'Protein',
    short: 'PROTIN',
    description: 'Whey and plant protein supplements',
  },
  {
    name: 'Gym Equipment',
    alias: 'Fitness',
    short: 'GYM',
    description: 'Home gym equipment including dumbbells and benches',
  },
  {
    name: 'Yoga Mats',
    alias: 'Yoga',
    short: 'YOGA',
    description: 'Non-slip yoga mats and accessories',
  },
  {
    name: 'Office Chairs',
    alias: 'Chairs',
    short: 'CHAIR',
    description: 'Ergonomic office chairs for long work sessions',
  },
  {
    name: 'Study Tables',
    alias: 'Tables',
    short: 'TABLE',
    description: 'Compact and modular study tables for home',
  },
  {
    name: 'Kitchen Appliances',
    alias: 'Kitchen',
    short: 'KITAPP',
    description: 'Mixer, blender, oven, and everyday kitchen appliances',
  },
  {
    name: 'Home Decor',
    alias: 'Decor',
    short: 'DECOR',
    description: 'Decorative lighting, wall art, and home accents',
  },
  {
    name: 'Skin Care',
    alias: 'Skincare',
    short: 'SKIN',
    description: 'Face wash, serums, moisturizers, and SPF products',
  },
  {
    name: 'Hair Care',
    alias: 'Haircare',
    short: 'HAIR',
    description: 'Shampoo, conditioner, and hair treatment products',
  },
  {
    name: 'Baby Care',
    alias: 'Baby',
    short: 'BABY',
    description: 'Baby diapers, wipes, and gentle care essentials',
  },
  {
    name: 'Pet Food',
    alias: 'Pets',
    short: 'PET',
    description: 'Dry and wet food options for dogs and cats',
  },
  {
    name: 'Car Accessories',
    alias: 'Car Accy',
    short: 'CARACC',
    description: 'Car chargers, mats, cleaners, and utility accessories',
  },
  {
    name: 'Bike Helmets',
    alias: 'Helmets',
    short: 'HELM',
    description: 'Safety-certified helmets for bike riders',
  },
];

const buildUpsertPayload = (group, sortOrder, timestamp) => ({
  itgAlias: group.alias,
  itgShort: group.short,
  itgDescription: group.description,
  itgParentId: null,
  itgSort: sortOrder,
  itgLevel: 0,
  itgIsActive: true,
  itgIsDeleted: false,
  itgModifiedOn: timestamp,
  itgModifiedBy: ACTOR,
});

async function main() {
  const now = new Date();
  let createdCount = 0;
  let updatedCount = 0;

  for (let index = 0; index < DUMMY_ITEM_GROUPS.length; index += 1) {
    const group = DUMMY_ITEM_GROUPS[index];
    const sortOrder = index + 1;

    const existing = await prisma.itemGroupMaster.findUnique({
      where: { itgName: group.name },
      select: { itgId: true },
    });

    const payload = buildUpsertPayload(group, sortOrder, now);

    const upserted = await prisma.itemGroupMaster.upsert({
      where: { itgName: group.name },
      update: payload,
      create: {
        itgName: group.name,
        itgCreatedOn: now,
        itgCreatedBy: ACTOR,
        ...payload,
      },
      select: { itgId: true },
    });

    await prisma.itemGroupMaster.update({
      where: { itgId: upserted.itgId },
      data: {
        itgPathIdsCache: [upserted.itgId],
      },
    });

    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  const total = await prisma.itemGroupMaster.count({
    where: { itgIsDeleted: false },
  });

  console.log(
    `Seed complete. created=${createdCount}, updated=${updatedCount}, active_total=${total}`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to seed item_group_master:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
