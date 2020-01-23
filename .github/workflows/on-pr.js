const path = require("path")
const fs = require("fs")
const GitHub = require("github-api")
 
const gh = new GitHub()

const OWNER = "aws"
const REPO = "aws-cdk"

const issues = gh.getIssues(OWNER, REPO);
const repo = gh.getRepo(OWNER, REPO);

class ValidationFailed extends Error {
    constructor(message) {
        super(message);
    }    
}

function fetchFiles(number) {
    return repo.listPullRequestFiles(number);
}

function fetchIssue(number) {
    return issues.getIssue(number);
}

function readNumberFromGithubEvent() {

    // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/using-environment-variables

    console.log("Extracting PR number from Github Event...");

    github_event = process.env.GITHUB_EVENT_PATH;

    if (!github_event) {
        throw new Error("GITHUB_EVENT_PATH undefined");
    }

    return JSON.parse(fs.readFileSync(github_event)).number
}

function isSemantic(title, type) {
    return title.match(type + "(.*):");
}

function isFeature(title) {
    return isSemantic(title, "feat")
}

function isFix(title) {
    return isSemantic(title, "fix")
}

async function validate(number, validator) {

    try {
        number = number ? number : readNumberFromGithubEvent();
    } catch (err) {
        throw new Error("Unable to determine PR number: " + err.message 
            + ". Either pass it as the first argument, or execute from GitHub Acrions.");
    }

    const issue = await fetchIssue(number);
    const files = await fetchFiles(number);

    validator(issue.data.title, files.data);                    

}

function validateTest(files) {
    tests = files.filter(f => f.filename.split(path.sep).includes("test"));

    if (tests.length == 0) {
        throw new Error(semanticType + "Pull Requests (feat) must contain a change to a test file");
    };        
}

function validateReadme(files) {
    readmes = files.filter(f => path.basename(f.filename) == "README.md");

    if (readmes.length == 0) {
        throw new Error(semanticType + " Pull Requests (feat) must contain a change to a readme file");
    };
}

async function featureContainsReadme(number) {
    return validate(number, function(title, files) {
        if (isFeature(title)) validateReadme(files);
    });
};

async function featureContainsTest(number) {
    return validate(number, function(title, files) {
        if (isFeature(title)) validateTest(files);
    });
};

async function fixContainsTest(number) {
    return validate(number, function(title, files) {
        if (isFix(title)) validateTest(files);
    });
};

module.exports.mandatoryChanges = async function(number) {

    console.log("⌛ Validating...");

    try {
    
        await featureContainsReadme(number);
        await featureContainsTest(number);
        await fixContainsTest(number);
    
        console.log("✅ success")
        
    } catch (err) {
        
        if (err instanceof ValidationFailed) {
            console.log("❌ Vadlidation failed: " + err.message);
        } else {
            console.log("❌ Unable to validate: " + err.message);
            console.log(err.stack)
        }
        
        process.exit(1);
    }
    
}

require('make-runnable/custom')({
    printOutputFrame: false
})