// Mock data for members (to be replaced with actual data from the database)
const members = [
    { name: 'John Doe', role: 'Leader' },
    { name: 'Jane Smith', role: 'Member' },
];

// Function to add a new member
function addMember() {
    const newMember = {
        name: 'New Member',
        role: 'Member'
    };
    members.push(newMember);
    renderMembers();
}

// Function to edit a member
function editMember(name) {
    const member = members.find(m => m.name === name);
    if (member) {
        member.role = prompt('Edit role for ' + name, member.role);
        renderMembers();
    }
}

// Function to remove a member
function removeMember(name) {
    const index = members.findIndex(m => m.name === name);
    if (index !== -1) {
        members.splice(index, 1);
        renderMembers();
    }
}

// Function to render members list on the page
function renderMembers() {
    const membersList = document.querySelector('.members-list');
    membersList.innerHTML = '';
    members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.classList.add('member');
        memberDiv.innerHTML = `
            <div class="member-info">
                <h3>${member.name}</h3>
                <p>Role: ${member.role}</p>
            </div>
            <div class="member-actions">
                <button class="btn edit-btn" onclick="editMember('${member.name}')">Edit</button>
                <button class="btn remove-btn" onclick="removeMember('${member.name}')">Remove</button>
            </div>
        `;
        membersList.appendChild(memberDiv);
    });
}

// Initial rendering of members
renderMembers();