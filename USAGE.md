## Installation

1. Install [Copilot Ops](https://github.com/apps/copilot-ops) in your desired repository
1. Create an issue template at `.github/ISSUE_TEMPLATE/copilot_ops.yaml` with the following contents:
	```yaml
	---
	name: Kubernetes Resource Generation
	description: Request some Kubernetes resources to be automatically generated for you.
	title: "[Resource Request]: "
	body: 
	  - type: input
	    id: botInput
	    validations:
	      required: true
	    attributes:
	      label: Prompt
	      description: |
	        Describe what you would like to be generated. An AI will generate resources
	        based on this input.
	      placeholder: A 50Gi PVC named 'mp4 files'
	```

## Usage

Using the bot is simple: create a new issue using the Copilot Ops template and the bot will automatically generate a pull request for you!

Once the PR is created, you can issue the commands listed in the [table below](#commands) in either the issue discussion or on the corresponding pull request.

### Commands

Execute a command by using the `/` prefix, for example: `/help`.

The bot supports the following commands:

| Command | Description | Example Usage |
| ------- | ----------- | ------- |
| `help` | Display a help message | `/help` | 
| `reroll` | Rerun the generation process with the original issue's input | `/reroll` |
| `reroll [prompt]` | Try generating another set of files using the provided prompt | `/reroll Create a MySQL deployment named 'user-database'` | 