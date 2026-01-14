import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        where: {
            pushNotificationsEnabled: true,
            isActive: true
        },
        select: {
            username: true,
            pushNotificationsEnabled: true,
            _count: {
                select: {
                    push_subscriptions: true
                }
            }
        }
    })

    console.log('--- Utenti con Notifiche Web Abilitate ---')
    users.forEach(user => {
        console.log(`- ${user.username} (${user._count.push_subscriptions} dispositivi registrati)`)
    })
    console.log('------------------------------------------')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
