const xl = require("excel4node")
require("dotenv").config()

const getFollowersAgesPercent = async (userId) => {
    const response = await fetch(
        `https://api.vk.com/method/users.getFollowers?user_id=${userId}&v=5.199&fields=city,followers_count,has_photo,last_seen,maiden_name,relation,sex,bdate&lang=0`,
        {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${process.env.SERVICE_KEY}`,
            },
        }
    )

    const data = await response.json()

    if (data?.response?.items) {
        let totalFollowersWithBDate = 0
        let totalFollowersWithSearchingAge = 0
        data.response.items.forEach((item) => {
            if ("bdate" in item && item.bdate.split(".").length === 3) {
                totalFollowersWithBDate++
                if (
                    item.bdate.split(".")[2] >= process.env.MIN_BIRTH_YEAR &&
                    item.bdate.split(".")[2] <= process.env.MAX_BIRTH_YEAR
                ) {
                    totalFollowersWithSearchingAge++
                }
            }
        })
        const percentage = (totalFollowersWithSearchingAge / totalFollowersWithBDate) * 100
        return Math.round(percentage)
    } else {
        return 0
    }
}

getGroupFollowers = async (groupId, offset = 0) => {
    console.log("Вызов с offset: ", offset)

    const response = await fetch(
        `https://api.vk.com/method/groups.getMembers?group_id=${groupId}&v=5.199&fields=city,followers_count,has_photo,last_seen,maiden_name,relation,sex,bdate&offset=${offset}&lang=0`,
        {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${process.env.SERVICE_KEY}`,
            },
        }
    )

    const data = await response.json()
    const { count, items } = data.response

    const result = []

    const getResult = async () => {
        for (const item of items) {
            const lastVisitTime = item.last_seen?.time
            const lastVisitDate = new Date(lastVisitTime * 1000)
            const currentDate = new Date()
            const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)

            if (
                item.is_closed === false &&
                item.sex === 1 &&
                item.city?.id == process.env.CITY_ID &&
                item.has_photo === 1 &&
                item.followers_count <= 1000 &&
                !item.maiden_name &&
                (item.relation === 0 || item.relation === 1 || item.relation === 6) &&
                lastVisitDate >= weekAgo
            ) {
                if (
                    "bdate" in item &&
                    item.bdate.split(".").length === 3 &&
                    item.bdate.split(".")[2] >= process.env.MIN_BIRTH_YEAR &&
                    item.bdate.split(".")[2] <= process.env.MAX_BIRTH_YEAR
                ) {
                    result.push(item)
                } else {
                    if (
                        !("bdate" in item) ||
                        ("bdate" in item && item.bdate.split(".").length !== 3)
                    ) {
                        const percentage = await getFollowersAgesPercent(item.id)
                        if (
                            percentage >=
                            Number(process.env.PERCENTAGE_OF_FOLLOWERS_WITH_DESIRED_AGE)
                        ) {
                            result.push({
                                ...item,
                                percentage,
                            })
                        }
                    }
                }
            }
        }
    }

    await getResult()

    console.log("Найдено: ", result.length)

    if (count > offset + 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return result.concat(await getGroupFollowers(groupId, offset + 1000))
    } else {
        console.log("Готово. Иди брей яйца и вперед на охоту!")
        return result
    }
}

const calculateAge = (birthdate) => {
    const birthdateParts = birthdate.split(".")
    const birthdateDate = new Date(birthdateParts[2], birthdateParts[1] - 1, birthdateParts[0])
    const currentDate = new Date()
    const age = currentDate.getFullYear() - birthdateDate.getFullYear()
    const monthDiff = currentDate.getMonth() - birthdateDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < birthdateDate.getDate())) {
        return age - 1
    } else {
        return age
    }
}

const getRelation = (relation) => {
    switch (relation) {
        case 0:
            return "Не указано"
        case 1:
            return "Не замужем"
        case 6:
            return "В активном поиске"
        default:
            return "Не указано"
    }
}

getGroupFollowers(process.env.GROUP_ID_OR_NAME).then((data) => {
    const wb = new xl.Workbook()
    const ws = wb.addWorksheet("Sheet 1")
    const titleStyle = wb.createStyle({
        font: {
            size: 16,
            bold: true,
        },
    })
    ws.cell(1, 1).string("Имя").style(titleStyle)
    ws.cell(1, 2).string("Фамилия").style(titleStyle)
    ws.cell(1, 3).string("Дата рождения").style(titleStyle)
    ws.cell(1, 4).string("Возраст").style(titleStyle)
    ws.cell(1, 5).string("Процент подписчиков с искомым возрастом").style(titleStyle)
    ws.cell(1, 6).string("Семейное положение").style(titleStyle)
    ws.cell(1, 7).string("Страница в VK").style(titleStyle)
    data.forEach((item, index) => {
        ws.cell(index + 2, 1).string(item.first_name)
        ws.cell(index + 2, 2).string(item.last_name)
        ws.cell(index + 2, 3).string(item.bdate || "Не указано")
        if (item.bdate && item.bdate.split(".").length === 3) {
            ws.cell(index + 2, 4).number(calculateAge(item.bdate))
        }
        if (item.percentage) {
            ws.cell(index + 2, 5).number(item.percentage)
        }
        ws.cell(index + 2, 6).string(getRelation(item.relation))
        ws.cell(index + 2, 7).link(`https://vk.com/id${item.id}`)
    })
    wb.write(`results/Telochki.xlsx`)
})
