### Search Anime

```js
// Menu: Search Anime
// Description: Use the jikan.moe API to search anime

let anime = await arg("Anime:")

let response = await get(
  `https://api.jikan.moe/v3/search/anime?q=${anime}`
)

let { image_url, title } = response.data.results[0]

showImage(image_url, { title })

```


### App Launcher

```js
// Menu: App Launcher
// Description: Search for an app then launch it

let createChoices = async () => {
  let apps = await fileSearch("", {
    onlyin: "/",
    kind: "application",
  })

  let prefs = await fileSearch("", {
    onlyin: "/",
    kind: "preferences",
  })

  let group = path => apps =>
    apps
      .filter(app => app.match(path))
      .sort((a, b) => {
        let aName = a.replace(/.*\//, "")
        let bName = b.replace(/.*\//, "")

        return aName > bName ? 1 : aName < bName ? -1 : 0
      })

  return [
    ...group(/^\/Applications\/(?!Utilities)/)(apps),
    ...group(/\.prefPane$/)(prefs),
    ...group(/^\/Applications\/Utilities/)(apps),
    ...group(/System/)(apps),
    ...group(/Users/)(apps),
  ].map(value => {
    return {
      name: value.split("/").pop().replace(".app", ""),
      value,
      description: value,
    }
  })
}

let appsDb = await db("apps", async () => ({
  choices: await createChoices(),
}))

let app = await arg("Select app:", appsDb.choices)
let command = `open -a "${app}"`
if (app.endsWith(".prefPane")) {
  command = `open ${app}`
}
exec(command)

```


### Book Search

```js
// Menu: Book Search
// Description: Use Open Library API to search for books

let query = await arg('Search for a book title:')

//This API can be a little slow. Wait a couple seconds
let response = await get(`http://openlibrary.org/search.json?q=${query}`)

let transform = ({title, author_name}) =>
  `* "${title}" - ${author_name?.length && author_name[0]}`

let markdown = response.data.docs.map(transform).join('\n')

inspect(markdown, 'md')

```


### Center App

```js
// Menu: Center App
// Description: Center the frontmost app

let { workArea, bounds } = await getActiveScreen()

let { width, height } = workArea
let { x, y } = bounds
let padding = 100

let top = y + padding
let left = x + padding
let right = x + width - padding
let bottom = y + height - padding

setActiveAppBounds({
  top,
  left,
  right,
  bottom,
})

```


### Open Chrome Tab

```js
// Menu: Open Chrome Tab
// Description: List all Chrome tabs. Then switch to that tab

let currentTabs = await getTabs()

let bookmarks = await readFile(
  home(
    "Library/Application Support/Google/Chrome/Default/Bookmarks"
  )
)

bookmarks = JSON.parse(bookmarks)
bookmarks = bookmarks.roots.bookmark_bar.children

let bookmarkChoices = bookmarks.map(({ name, url }) => {
  return {
    name: url,
    description: name,
    value: url,
  }
})

let currentOpenChoices = currentTabs.map(
  ({ url, title }) => ({
    name: url,
    value: url,
    description: title,
  })
)

let bookmarksAndOpen = [
  ...bookmarkChoices,
  ...currentOpenChoices,
]
let choices = _.uniqBy(bookmarksAndOpen, "name")

let url = await arg("Focus Chrome tab:", choices)

focusTab(url)

```


### Chrome Tab Switcher

```js
// Menu: Chrome Tab Switcher
// Description: List all Chrome tabs. Then switch to that tab

let tabs = await getTabs()

let url = await arg(
  "Select Chrome tab:",
  tabs.map(({ url, title }) => ({
    name: url,
    value: url,
    description: title,
  }))
)

focusTab(url)

```


### Convert Colors

```js
// Menu: Convert Colors
// Description: Converts colors between rgb, hex, etc

let convert = await npm("color-convert")

let createChoice = (type, value, input) => {
  return {
    name: type + ": " + value,
    value,
    html: `<div class="h-full w-full p-1 text-xs flex justify-center items-center font-bold" style="background-color:${input}">
      <span>${value}</span>
      </div>`,
  }
}

//using a function with "input" allows you to generate values
let conversion = await arg("Enter color:", input => {
  if (input.startsWith("#")) {
    return ["rgb", "cmyk", "hsl"].map(type => {
      let value = convert.hex[type](input).toString()
      return createChoice(type, value, input)
    })
  }

  //two or more lowercase
  if (input.match(/^[a-z]{2,}/)) {
    return ["rgb", "hex", "cmyk", "hsl"]
      .map(type => {
        try {
          let value =
            convert.keyword[type](input).toString()

          return createChoice(type, value, input)
        } catch (error) {
          return ""
        }
      })
      .filter(Boolean)
  }

  return []
})

setSelectedText(conversion)

```


### focus-twitter

```js
// Description: Launch Twitter in Chrome. If Twitter is already open, switch to that tab.
// Shortcut: opt t

//runs the "chrome-tab" script with twitter.com passed into the first `arg`
await run("chrome-tab", "twitter.com")

```


### Giphy

```js
// Menu: Giphy
// Description: Search giphy. Paste link.

let download = await npm("image-downloader")
let queryString = await npm("query-string")

let GIPHY_API_KEY = await env("GIPHY_API_KEY", {
  hint: md(
    `Get a [Giphy API Key](https://developers.giphy.com/dashboard/)`
  ),
  ignoreBlur: true,
  secret: true,
})

let search = q =>
  `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${q}&limit=10&offset=0&rating=g&lang=en`

let { input, url } = await arg(
  "Search giphy:",
  async input => {
    if (!input) return []
    let query = search(input)
    let { data } = await get(query)

    return data.data.map(gif => {
      return {
        name: gif.title.trim() || gif.slug,
        value: {
          input,
          url: gif.images.original.url,
        },
        preview: `<img src="${gif.images.downsized.url}" alt="">`,
      }
    })
  }
)

let formattedLink = await arg("Format to paste", [
  {
    name: "URL Only",
    value: url,
  },
  {
    name: "Markdown Image Link",
    value: `![${input}](${url})`,
  },
  {
    name: "HTML <img>",
    value: `<img src="${url}" alt="${input}">`,
  },
])

setSelectedText(formattedLink)

```


### Gist from Finder

```js
// Menu: Gist from Finder
// Description: Select a file in Finder, then create a Gist

let filePath = await getSelectedFile()
let file = filePath.split("/").pop()

let isPublic = await arg("Should the gist be public?", [
  { name: "No", value: false },
  { name: "Yes", value: true },
])

const body = {
  files: {
    [file]: {
      content: await readFile(filePath, "utf8"),
    },
  },
}

if (isPublic) body.public = true

let config = {
  headers: {
    Authorization:
      "Bearer " +
      (await env("GITHUB_GIST_TOKEN", {
        info: `Create a gist token: <a class="bg-white" href="https://github.com/settings/tokens/new">https://github.com/settings/tokens/new</a>`,
        message: `Set .env GITHUB_GIST_TOKEN:`,
      })),
  },
}
const response = await post(
  `https://api.github.com/gists`,
  body,
  config
)

exec(`open ` + response.data.html_url)

```


### Google Image Grid

```js
// Menu: Google Image Grid
// Description: Create a Grid of Images

let gis = await npm("g-i-s")

await arg("Search for images:", async input => {
  if (input.length < 3) return ``

  let searchResults = await new Promise(res => {
    gis(input, (_, results) => {
      res(results)
    })
  })

  return `<div class="flex flex-wrap">${searchResults
    .map(({ url }) => `<img class="h-32" src="${url}" />`)
    .join("")}</div>`
})

```


### Hello World

```js
// Menu: Hello World
// Description: Enter an name, speak it back

let name = await arg(`What's your name?`)
say(`Hello, ${name}!`)

```


### Detect Image Width and Height

```js
// Menu: Detect Image Width and Height
// Description: Show the metadata of an image

let sharp = await npm("sharp")

let image = await arg("Search an image:", async input => {
  if (input.length < 3) return []
  let files = await fileSearch(input, { kind: "image" })

  return files.map(path => {
    return {
      name: path.split("/").pop(),
      value: path,
      description: path,
    }
  })
})

let { width, height } = await sharp(image).metadata()

console.log({ width, height })
await arg(`Width: ${width} Height: ${height}`)

```


### Resize an Image

```js
// Menu: Resize an Image
// Description: Select an image in Finder. Type option + i to resize it.
// Shortcut: opt i

let sharp = await npm("sharp")

let imagePath = await getSelectedFile()

let width = Number(await arg("Enter width:"))

let metadata = await sharp(imagePath).metadata()

let newHeight = Math.floor(
  metadata.height * (width / metadata.width)
)

let lastDot = /.(?!.*\.)/
let resizedImageName = imagePath.replace(
  lastDot,
  `-${width}.`
)

await sharp(imagePath)
  .resize(width, newHeight)
  .toFile(resizedImageName)

```


### Dad Joke

```js
// Menu: Dad Joke
// Description: Logs out a Dad Joke from icanhazdadjoke.com

let response = await get(`https://icanhazdadjoke.com/`, {
  headers: {
    Accept: "text/plain",
  },
})

let joke = response.data
setPanel(joke)
say(joke)

```


### New Journal Entry

```js
// Menu: New Journal Entry
// Description: Generate a file using the current date in a specified folder
let { format } = await npm("date-fns")

let date = format(new Date(), "yyyy-MM-dd")

let journalPath = await env("JOURNAL_PATH")
if (!(await isDir(journalPath))) {
  mkdir("-p", journalPath)
}

let journalFile = path.join(journalPath, date + ".md")
if (!(await isFile(journalFile))) {
  let journalPrompt = `How are you feeling today?`
  await writeFile(journalFile, journalPrompt)
}

edit(journalFile, env?.JOURNAL_PATH)

```


### Open Project

```js
// Menu: Open Project
// Description: List dev projects

let { projects, write } = await db("projects", {
  projects: [
    "~/.kit",
    "~/projects/kitapp",
    "~/projects/scriptkit.com",
  ],
})

onTab("Open", async () => {
  let project = await arg("Open project:", projects)
  edit(project)
})

onTab("Add", async () => {
  while (true) {
    let project = await arg(
      "Add path to project:",
      md(projects.map(project => `* ${project}`).join("\n"))
    )

    projects.push(project)
    await write()
  }
})

onTab("Remove", async () => {
  while (true) {
    let project = await arg("Open project:", projects)

    let indexOfProject = projects.indexOf(project)
    projects.splice(indexOfProject, 1)
    await write()
  }
})

```


### Paste URL

```js
// Menu: Paste URL
// Description: Copy the current URL from your browser. Paste it at cursor.

let url = await getActiveTab()
await setSelectedText(url)

```


### Project Name

```js
// Menu: Project Name
// Description: Generate an alliteraive, dashed project name, copies it to the clipboard, and shows a notification

let { generate } = await npm("project-name-generator")

const name = generate({
  word: 2,
  alliterative: true,
}).dashed

await setSelectedText(name)

```


### Quick Thoughts

```js
// Menu: Quick Thoughts
// Description: Add lines to today's journal page

let { format } = await npm("date-fns")

let date = format(new Date(), "yyyy-MM-dd")
let thoughtsPath = await env("THOUGHTS_PATH")
let thoughtFile = path.join(thoughtsPath, date + ".md")

let firstEntry = true
let addThought = async thought => {
  if (firstEntry) {
    thought = `
- ${format(new Date(), "hh:mmaa")}
  ${thought}\n`
    firstEntry = false
  } else {
    thought = `  ${thought}\n`
  }

  await appendFile(thoughtFile, thought)
}

let openThoughtFile = async () => {
  let { stdout } = exec(`wc ${thoughtFile}`, {
    silent: true,
  })
  let lineCount = stdout.trim().split(" ").shift()
  edit(thoughtFile, thoughtsPath, lineCount + 1) //open with cursor at end
  await wait(500)
  exit()
}

if (!(await isFile(thoughtFile)))
  await writeFile(thoughtFile, `# ${date}\n`)

while (true) {
  let thought = await arg({
    placeholder: "Thought:",
    hint: `Type "open" to open journal`,
  })
  if (thought === "open") {
    await openThoughtFile()
  } else {
    await addThought(thought)
  }
}

```


### Read News

```js
// Menu: Read News
// Description: Scrape headlines from news.google.com then pick headline to read

let headlines = await scrapeSelector(
  "https://news.google.com",
  "h3",
  el => ({
    name: el.innerText,
    value: el.firstChild.href,
  })
)

let url = await arg("What do you want to read?", headlines)

exec(`open "${url}"`)

```


### Reddit

```js
// Menu: Reddit
// Description: Browse Reddit from Script Kit

let Reddit = await npm("reddit")

let envOptions = {
  ignoreBlur: true,
  hint: md(
    `[Create a reddit app](https://www.reddit.com/prefs/apps)`
  ),
  secret: true,
}

let reddit = new Reddit({
  username: await env("REDDIT_USERNAME"),
  password: await env("REDDIT_PASSWORD"),
  appId: await env("REDDIT_APP_ID", envOptions),
  appSecret: await env("REDDIT_APP_SECRET", envOptions),
  userAgent: `ScriptKit/1.0.0 (https://scriptkit.com)`,
})

let subreddits = [
  "funny",
  "aww",
  "dataisbeautiful",
  "mildlyinteresting",
  "RocketLeague",
]

subreddits.forEach(sub => {
  onTab(sub, async () => {
    let url = await arg(
      "Select post to open:",
      async () => {
        let best = await reddit.get(`/r/${sub}/hot`)

        return best.data.children.map(({ data }) => {
          let {
            title,
            thumbnail,
            url,
            subreddit_name_prefixed,
            preview,
          } = data

          let resolutions =
            preview?.images?.[0]?.resolutions
          let previewImage =
            resolutions?.[resolutions?.length - 1]?.url

          return {
            name: title,
            description: subreddit_name_prefixed,
            value: url,
            img: thumbnail,
            ...(previewImage && {
              preview: md(`
![${title}](${previewImage})

### ${title}          
                `),
            }),
          }
        })
      }
    )

    exec(`open "${url}"`)
  })
})

```


### Share Selected File

```js
// Menu: Share Selected File
// Description: Select a file in Finder. Creates tunnel and copies link to clipboard.
// Background: true

let ngrok = await npm("ngrok")
let handler = await npm("serve-handler")
let exitHook = await npm("exit-hook")
let http = await import("http")

let filePath = await getSelectedFile()

let symLinkName = _.last(
  filePath.split(path.sep)
).replaceAll(" ", "-")
let symLinkPath = tmp(symLinkName)

console.log(`Creating temporary symlink: ${symLinkPath}`)
ln(filePath, symLinkPath)

let port = 3033

const server = http.createServer(handler)

cd(tmp())

server.listen(port, async () => {
  let tunnel = await ngrok.connect(port)
  let shareLink = tunnel + "/" + symLinkName
  console.log(
    chalk`{yellow ${shareLink}} copied to clipboard`
  )
  copy(shareLink)
})

exitHook(() => {
  server.close()
  if (test("-f", symLinkPath)) {
    console.log(
      `Removing temporary symlink: ${symLinkPath}`
    )
    exec(`rm ${symLinkPath}`)
  }
})

```


### Open Sound Prefs

```js
// Menu: Open Sound Prefs
// Description: Open the Sound prefs panel

exec(`open /System/Library/PreferencePanes/Sound.prefPane`)

```


### Speak Script

```js
// Menu: Speak Script
// Description: Run a Script based on Speech Input

let { scripts } = await db("scripts")

let escapedScripts = scripts.map(script => ({
  name: `"${script.name.replace(/"/g, '\\"')}"`, //escape quotes
  value: script.filePath,
}))

let speakableScripts = escapedScripts
  .map(({ name }) => name)
  .join(",")

let speech = await applescript(String.raw`
tell application "SpeechRecognitionServer"
	listen for {${speakableScripts}}
end tell
`)

let script = escapedScripts.find(
  script => script.name == `"${speech}"`
)

await run(script.value)

```


### Speed Reader

```js
// Menu: Speed Reader
// Description: Display clipboard content at a defined rate

let wpm = 1000 * (60 / (await arg('Enter words per minute:')))

let text = await paste()
text = text
  .trim()
  .split(' ')
  .filter(Boolean)
  .flatMap((sentence) => sentence.trim().split(' '))

let i = 0

let id = setInterval(() => {
  setPlaceholder(` ${text[i++]}`)
  if (i >= text.length) clearInterval(id)
}, wpm)

```


### Synonym

```js
// Menu: Synonym
// Description: List synonyms

let synonym = await arg("Type a word", async input => {
  if (!input || input?.length < 3) return []
  let url = `https://api.datamuse.com/words?ml=${input}&md=d`
  let response = await get(url)

  return response.data.map(({ word, defs }) => {
    return {
      name: `${word}${defs?.[0] && ` - ${defs[0]}`}`,
      value: word,
      selected: `Paste ${word}`,
    }
  })
})

setSelectedText(synonym)

```


### Title Case

```js
// Menu: Title Case
// Description: Converts the selected text to title case

let { titleCase } = await npm("title-case")

let text = await getSelectedText()
let titleText = titleCase(text)
await setSelectedText(titleText)

```


### Update Twitter Name

```js
// Menu: Update Twitter Name
// Description: Change your name on twitter

let Twitter = await npm('twitter-lite')

let envOptions = {
  hint: md(
    `You need to [create an app](https://developer.twitter.com/en/apps) to get these keys/tokens`,
  ),
  ignoreBlur: true,
  secret: true,
}

let client = new Twitter({
  consumer_key: await env('TWITTER_CONSUMER_KEY', envOptions),
  consumer_secret: await env('TWITTER_CONSUMER_SECRET', envOptions),
  access_token_key: await env('TWITTER_ACCESS_TOKEN_KEY', envOptions),
  access_token_secret: await env('TWITTER_ACCESS_TOKEN_SECRET', envOptions),
})

let name = await arg('Enter new twitter name:')

let response = await client
  .post('account/update_profile', {
    name,
  })
  .catch((error) => console.log(error))

```


### Vocab Quiz

```js
// Menu: Vocab Quiz
// Description: Quiz on random vocab words

await npm("wordnet-db")
let randomWord = await npm("random-word")
let { WordNet } = await npm("natural")

let wordNet = new WordNet()
let words = []

while (true) {
  setPlaceholder(`Finding random word and definitions...`)

  while (words.length < 4) {
    let quizWord = randomWord()
    let results = await new Promise(resolve => {
      wordNet.lookup(quizWord, resolve)
    })
    if (results.length) {
      let [{ lemma, def }] = results
      words.push({ name: def, value: lemma })
    }
  }

  let word = words[0]
  let result = await arg(
    `What does "${word.value}" mean?`,
    _.shuffle(words)
  )

  let correct = word.value === result
  setPlaceholder(
    `${correct ? "✅" : "🚫"} ${word.value}: ${word.name}`
  )
  words = []

  await wait(2000)
}

```
