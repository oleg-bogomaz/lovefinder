require("dotenv").config()

const getUsersData = async () => {
    const response = await fetch(
        `https://api.vk.com/method/users.getFollowers?user_id=318433444&v=5.199&fields=city,followers_count,has_photo,last_seen,maiden_name,relation,sex,bdate&lang=0`,
        {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${process.env.SERVICE_KEY}`,
            },
        }
    )

    const data = await response.json()

    return data
}

getUsersData().then((data) => {
    console.log(JSON.stringify(data))
})
