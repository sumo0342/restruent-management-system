import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  // Make this script safe to run more than once against the same database.
  // `db:push` never wipes data, so if you've seeded before (even an older
  // version of this script), the demo restaurant/users/branches already
  // exist — recreating them would hit the unique constraints on
  // User.email and Branch/Table/(restaurantId,name/number). Clear out any
  // previous run's demo data first, scoped to the same restaurant name and
  // the same fixed set of demo emails, so it never touches real data you
  // might also have in this database.
  const demoEmails = [
    "owner@restaurant.com",
    "manager@restaurant.com", "chef@restaurant.com", "waiter1@restaurant.com", "waiter2@restaurant.com",
    "manager2@restaurant.com", "chef2@restaurant.com", "waiter3@restaurant.com",
  ];

  const priorRestaurants = await prisma.restaurant.findMany({ where: { name: "Spice Route Kitchen" } });
  for (const r of priorRestaurants) {
    await prisma.payment.deleteMany({ where: { bill: { restaurantId: r.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { restaurantId: r.id } } });
    await prisma.order.deleteMany({ where: { restaurantId: r.id } });
    await prisma.bill.deleteMany({ where: { restaurantId: r.id } });
    await prisma.tableSession.deleteMany({ where: { table: { restaurantId: r.id } } });
    await prisma.menuItem.deleteMany({ where: { restaurantId: r.id } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId: r.id } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId: r.id } });
    await prisma.shift.deleteMany({ where: { restaurantId: r.id } });
    await prisma.note.deleteMany({ where: { restaurantId: r.id } });
    await prisma.maintenanceRecord.deleteMany({ where: { restaurantId: r.id } });
    await prisma.auditLog.deleteMany({ where: { restaurantId: r.id } });
    await prisma.session.deleteMany({ where: { user: { restaurantId: r.id } } });
    await prisma.user.deleteMany({ where: { restaurantId: r.id } });
    await prisma.branch.deleteMany({ where: { restaurantId: r.id } });
    await prisma.restaurant.delete({ where: { id: r.id } });
  }
  // Belt-and-suspenders: also remove any stray user sitting on one of the
  // fixed demo emails under a *different* restaurant (e.g. left over from
  // testing before branches existed), since email is globally unique.
  await prisma.session.deleteMany({ where: { user: { email: { in: demoEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Spice Route Kitchen",
      address: "12 MG Road, Kharagpur, WB",
      phone: "+91 98765 43210",
      gstin: "22AAAAA0000A1Z5",
      taxPercent: 5,
      serviceChargePercent: 0,
      invoiceFooter: "Thank you for dining with us — visit again!",
    },
  });

  const hash = (pw: string) => bcrypt.hash(pw, 12);

  // ---------------------------------------------------------------------
  // BRANCHES — this is entirely optional (see prisma/schema.prisma). The
  // demo data below seeds two, so you can see branch isolation working out
  // of the box: staff logged into Main Street never see Riverside's
  // tables/orders/menu, and vice versa. If you don't want this, delete the
  // "branches" block and drop `branchId` from everything below it — every
  // table/user/menu item just falls back to branchId: null, and the app
  // runs as one shared location like it always did.
  // ---------------------------------------------------------------------
  const mainStreet = await prisma.branch.create({
    data: { name: "Main Street", address: "12 MG Road, Kharagpur, WB", restaurantId: restaurant.id },
  });
  const riverside = await prisma.branch.create({
    data: { name: "Riverside", address: "4 Ghat Road, Kharagpur, WB", restaurantId: restaurant.id },
  });

  await prisma.user.createMany({
    data: [
      // Owner isn't tied to a branch — the OWNER role always sees every
      // branch at once regardless of branchId.
      { name: "Owner Anita", email: "owner@restaurant.com", role: "OWNER", passwordHash: await hash("Owner@123"), restaurantId: restaurant.id },

      // Main Street staff
      { name: "Manager Ravi", email: "manager@restaurant.com", role: "MANAGER", passwordHash: await hash("Manager@123"), restaurantId: restaurant.id, branchId: mainStreet.id },
      { name: "Chef Meera", email: "chef@restaurant.com", role: "KITCHEN", passwordHash: await hash("Chef@123"), restaurantId: restaurant.id, branchId: mainStreet.id },
      { name: "Waiter John", email: "waiter1@restaurant.com", role: "WAITER", passwordHash: await hash("Waiter@123"), restaurantId: restaurant.id, branchId: mainStreet.id },
      { name: "Waiter Priya", email: "waiter2@restaurant.com", role: "WAITER", passwordHash: await hash("Waiter@123"), restaurantId: restaurant.id, branchId: mainStreet.id },

      // Riverside staff
      { name: "Manager Nikhil", email: "manager2@restaurant.com", role: "MANAGER", passwordHash: await hash("Manager@123"), restaurantId: restaurant.id, branchId: riverside.id },
      { name: "Chef Arjun", email: "chef2@restaurant.com", role: "KITCHEN", passwordHash: await hash("Chef@123"), restaurantId: restaurant.id, branchId: riverside.id },
      { name: "Waiter Sana", email: "waiter3@restaurant.com", role: "WAITER", passwordHash: await hash("Waiter@123"), restaurantId: restaurant.id, branchId: riverside.id },
    ],
  });

  const mainStreetTables = [
    ["01", 2, "Main Hall"], ["02", 2, "Main Hall"], ["03", 4, "Main Hall"], ["04", 4, "Main Hall"],
    ["05", 4, "Main Hall"], ["06", 6, "Main Hall"], ["07", 6, "Terrace"], ["08", 4, "Terrace"],
    ["09", 2, "Terrace"], ["10", 8, "Private Room"],
  ] as const;
  for (const [number, capacity, section] of mainStreetTables) {
    await prisma.restaurantTable.create({
      data: { number, capacity, section, restaurantId: restaurant.id, branchId: mainStreet.id },
    });
  }

  const riversideTables = [
    ["01", 2, "Riverside Deck"], ["02", 4, "Riverside Deck"], ["03", 4, "Riverside Deck"],
    ["04", 6, "Indoor"], ["05", 6, "Indoor"], ["06", 2, "Indoor"],
  ] as const;
  for (const [number, capacity, section] of riversideTables) {
    await prisma.restaurantTable.create({
      data: { number, capacity, section, restaurantId: restaurant.id, branchId: riverside.id },
    });
  }

  // Menu: categories/items are created per branch below so each location
  // has its own full menu. To share a category across every branch instead,
  // just omit branchId when creating it (see the model note in schema.prisma).
  const categories = ["Starters", "Main Course", "Biryani", "Drinks", "Desserts"];

  const items: { name: string; price: number; category: string; isVeg: boolean; prep?: number }[] = [
    { name: "Paneer Tikka", price: 220, category: "Starters", isVeg: true },
    { name: "Chicken Tikka", price: 260, category: "Starters", isVeg: false },
    { name: "Veg Spring Rolls", price: 180, category: "Starters", isVeg: true },
    { name: "Chilli Chicken", price: 250, category: "Starters", isVeg: false },
    { name: "Butter Chicken", price: 320, category: "Main Course", isVeg: false },
    { name: "Paneer Butter Masala", price: 280, category: "Main Course", isVeg: true },
    { name: "Dal Makhani", price: 220, category: "Main Course", isVeg: true },
    { name: "Kadai Vegetable", price: 240, category: "Main Course", isVeg: true },
    { name: "Chicken Biryani", price: 300, category: "Biryani", isVeg: false, prep: 20 },
    { name: "Mutton Biryani", price: 380, category: "Biryani", isVeg: false, prep: 25 },
    { name: "Veg Biryani", price: 250, category: "Biryani", isVeg: true, prep: 18 },
    { name: "Egg Biryani", price: 270, category: "Biryani", isVeg: false, prep: 18 },
    { name: "Coke", price: 60, category: "Drinks", isVeg: true, prep: 1 },
    { name: "Fresh Lime Soda", price: 80, category: "Drinks", isVeg: true, prep: 3 },
    { name: "Masala Chai", price: 50, category: "Drinks", isVeg: true, prep: 5 },
    { name: "Mango Lassi", price: 100, category: "Drinks", isVeg: true, prep: 3 },
    { name: "Gulab Jamun", price: 90, category: "Desserts", isVeg: true, prep: 2 },
    { name: "Ice Cream", price: 110, category: "Desserts", isVeg: true, prep: 1 },
    { name: "Rasmalai", price: 120, category: "Desserts", isVeg: true, prep: 2 },
    { name: "Chocolate Brownie", price: 150, category: "Desserts", isVeg: true, prep: 4 },
  ];

  async function seedMenuForBranch(branchId: string, riversideTwist: boolean) {
    const categoryRecords = await Promise.all(
      categories.map((name, i) =>
        prisma.menuCategory.create({ data: { name, sortOrder: i, restaurantId: restaurant.id, branchId } })
      )
    );
    const catId = (name: string) => categoryRecords.find((c) => c.name === name)!.id;

    for (const item of items) {
      // Riverside's menu is a genuinely separate list (different prices, one
      // extra seafood item) — not just a copy — to make the isolation
      // obvious when you compare the two branches side by side.
      const price = riversideTwist ? Math.round(item.price * 1.08) : item.price;
      await prisma.menuItem.create({
        data: {
          name: item.name,
          price,
          isVeg: item.isVeg,
          prepTimeMins: item.prep ?? 10,
          categoryId: catId(item.category),
          restaurantId: restaurant.id,
          branchId,
        },
      });
    }

    if (riversideTwist) {
      await prisma.menuItem.create({
        data: {
          name: "Grilled River Fish",
          price: 340,
          isVeg: false,
          prepTimeMins: 22,
          categoryId: catId("Main Course"),
          restaurantId: restaurant.id,
          branchId,
        },
      });
    }
  }

  await seedMenuForBranch(mainStreet.id, false);
  await seedMenuForBranch(riverside.id, true);

  console.log("Seed complete.");
  console.log("\nDemo accounts:");
  console.log("  owner@restaurant.com    / Owner@123   (sees both branches)");
  console.log("  --- Main Street ---");
  console.log("  manager@restaurant.com  / Manager@123");
  console.log("  chef@restaurant.com     / Chef@123");
  console.log("  waiter1@restaurant.com  / Waiter@123");
  console.log("  waiter2@restaurant.com  / Waiter@123");
  console.log("  --- Riverside ---");
  console.log("  manager2@restaurant.com / Manager@123");
  console.log("  chef2@restaurant.com    / Chef@123");
  console.log("  waiter3@restaurant.com  / Waiter@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
