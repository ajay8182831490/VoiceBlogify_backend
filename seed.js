import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const planFeatures = [
    { plan: 'FREE', featureName: 'Total Blogs Allowed', description: 'Maximum number of blogs a user can create.', limit: 1 },
    { plan: 'FREE', featureName: 'Audio Recording Length', description: 'Maximum audio length for recordings in minutes.', limit: 10 },
    { plan: 'FREE', featureName: 'Audio Recording File Size', description: 'Maximum file size for audio recordings in MB.', limit: 50 },
    { plan: 'BASIC', featureName: 'Total Blogs Allowed', description: 'Maximum number of blogs a user can create.', limit: 10 },
    { plan: 'BASIC', featureName: 'Audio Recording Length', description: 'Maximum audio length for recordings in minutes.', limit: 20 },
    { plan: 'BASIC', featureName: 'Audio Recording File Size', description: 'Maximum file size for audio recordings in MB.', limit: 20 },
    { plan: 'PREMIUM', featureName: 'Total Blogs Allowed', description: 'Maximum number of blogs a user can create.', limit: 20 },
    { plan: 'PREMIUM', featureName: 'Audio Recording Length', description: 'Maximum audio length for recordings in minutes.', limit: 60 },
    { plan: 'PREMIUM', featureName: 'Audio Recording File Size', description: 'Maximum file size for audio recordings in MB.', limit: 300 },
    { plan: 'BUISNESS', featureName: 'Total Blogs Allowed', description: 'Maximum number of blogs a user can create.', limit: 60 },
    { plan: 'BUISNESS', featureName: 'Audio Recording Length', description: 'Maximum audio length for recordings in minutes.', limit: 90 },
    { plan: 'BUISNESS', featureName: 'Audio Recording File Size', description: 'Maximum file size for audio recordings in MB.', limit: 500 },
];

async function main() {
    console.log("Start seeding...");

    for (const feature of planFeatures) {
        console.log(`Seeding feature: ${JSON.stringify(feature)}`);
        try {
            await prisma.planFeature.create({
                data: feature,
            });
            console.log(`Feature ${feature.featureName} for plan ${feature.plan} added.`);
        } catch (error) {
            console.error(`Error creating feature ${feature.featureName}:`, error);
        }
    }

    console.log("Seeding completed!");
}

main()
    .catch(e => {
        console.error("Error in main function:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
