const path = require("path")
const fs = require("fs")
const GitHub = require("github-api")
 
const gh = new GitHub()

const OWNER = "aws"
const REPO = "aws-cdk"

const issues = gh.getIssues(OWNER, REPO);
const repo = gh.getRepo(OWNER, REPO);

function fetchFiles(number) {
    return repo.listPullRequestFiles(number);
}

function fetchIssue(number) {
    return issues.getIssue(number);
}

function readNumberFromGithubEvent() {

    // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/using-environment-variables

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

function validate(number, validator) {

    try {
        number = number ? number : readNumberFromGithubEvent();
    } catch (err) {
        console.log("Unable to determine PR number: " + err.message 
            + ". Either pass it as the first argument, or execute from GitHub Acrions.")
        process.exit(1);
    }

    console.log("⌛ Validating...");

    fetchIssue(number)
        .then(function (issue) {
            fetchFiles(number)
                .then(function (files) {
                    validator(issue.data.title, files.data);            
                    console.log("✅ success")
                })
        .catch(function (err) {
            console.log("❌ Vadlidation failed: " + err.message);
            process.exit(1);
        })
    });                

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

module.exports.featureContainsReadme = function (number) {
    return validate(number, function(title, files) {
        if (isFeature(title)) validateReadme(files);
    });
};

module.exports.featureContainsTest = function (number) {
    return validate(number, function(title, files) {
        if (isFeature(title)) validateTest(files);
    });
};

module.exports.fixContainsTest = function (number) {
    return validate(number, function(title, files) {
        if (isFix(title)) validateTest(files);
    });
};

module.exports.all = function (number) {
    exports = this;
    exports.featureContainsReadme(number)
        .then(function () {
            exports.featureContainsTest(number)
                .then(function () {
                    exports.fixContainsTest(number);
                })
        })
}

require('make-runnable/custom')({
    printOutputFrame: false
})