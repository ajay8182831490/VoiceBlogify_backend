import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();


const planFeatures = [
    { plan: 'FREE', featureName: 'Total Blogs Allowed', limit: 1 },
    { plan: 'FREE', featureName: 'Audio Recording Length', limit: 10 }, // Minutes
    { plan: 'FREE', featureName: 'Audio Recording FileSIze', limit: 50 }, // Minutes
    { plan: 'BASIC', featureName: 'Total Blogs Allowed', limit: 10 },
    { plan: 'BASIC', featureName: 'Audio Recording Length', limit: 20 },
    { plan: 'BASIC', featureName: 'Audio Recording file size', limit: 20 },
    { plan: 'PREMIUM', featureName: 'Total Blogs Allowed', limit: 20 },
    { plan: 'PREMIUM', featureName: 'Audio Recording Length', limit: 60 },
    { plan: 'PREMIUM', featureName: 'Audio Recording file size', limit: 300 },
    { plan: 'BUISNESS', featureName: 'Total Blogs Allowed', limit: 60 },
    { plan: 'BUISNESS', featureName: 'Audio Recording Length', limit: 90 },
    { plan: 'BUISNESS', featureName: 'Audio Recording file size', limit: 500 },
];

async function main() {
    console.log("Start seeding...");

    for (const feature of planFeatures) {
        await prisma.planFeature.create({
            data: feature,
        });
    }

    console.log("Seeding completed!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
